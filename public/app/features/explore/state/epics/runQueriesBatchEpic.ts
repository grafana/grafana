import { Epic } from 'redux-observable';
import { from, Observable, Subject } from 'rxjs';
import { mergeMap, catchError, takeUntil, filter } from 'rxjs/operators';

import { ActionOf } from 'app/core/redux/actionCreatorFactory';
import { StoreState } from 'app/types/store';
import { buildQueryTransaction, updateHistory } from 'app/core/utils/explore';
import {
  clearQueriesAction,
  historyUpdatedAction,
  resetExploreAction,
  updateDatasourceInstanceAction,
  changeRefreshIntervalAction,
  processQueryErrorsAction,
  processQueryResultsAction,
  runQueriesBatchAction,
  RunQueriesBatchPayload,
  queryStartAction,
  limitMessageRatePayloadAction,
} from '../actionTypes';
import { DataStreamState, LoadingState } from '@grafana/ui';
import { isLive } from '@grafana/ui/src/components/RefreshPicker/RefreshPicker';

export const runQueriesBatchEpic: Epic<ActionOf<any>, ActionOf<any>, StoreState> = (action$, state$) => {
  return action$.ofType(runQueriesBatchAction.type).pipe(
    mergeMap((action: ActionOf<RunQueriesBatchPayload>) => {
      const { exploreId, queryOptions } = action.payload;
      const {
        datasourceInstance,
        eventBridge,
        queries,
        queryIntervals,
        range,
        scanning,
        history,
      } = state$.value.explore[exploreId];

      // Create an observable per runqueries
      // Within the observable create two subscriptions
      // First subscription: 'querySubscription' subscribes to the call to query method on datasourceinstance
      // Second subscription: 'streamSubscription' subscribes to events from the query methods observer callback
      const observable: Observable<ActionOf<any>> = Observable.create((outerObservable: Subject<any>) => {
        const datasourceId = datasourceInstance.meta.id;
        const transaction = buildQueryTransaction(queries, queryOptions, range, queryIntervals, scanning);
        outerObservable.next(queryStartAction({ exploreId }));

        const actions: Array<ActionOf<any>> = [];
        const now = Date.now();
        const streamHandler = new Subject<DataStreamState>();
        let datasourceUnsubscribe: Function = null;

        const streamSubscription = streamHandler.subscribe({
          next: event => {
            const { state, error, series } = event;
            if (state === LoadingState.Error) {
              eventBridge.emit('data-error', error);
              outerObservable.next(processQueryErrorsAction({ exploreId, response: error, datasourceId }));
            }

            if (state === LoadingState.Streaming) {
              series.forEach(data => {
                outerObservable.next(
                  limitMessageRatePayloadAction({
                    exploreId,
                    data,
                  })
                );
              });
            }

            if (state === LoadingState.Done) {
              eventBridge.emit('data-received', series || []);
              const latency = Date.now() - now;
              // Side-effect: Saving history in localstorage
              const nextHistory = updateHistory(history, datasourceId, queries);
              outerObservable.next(historyUpdatedAction({ exploreId, history: nextHistory }));
              outerObservable.next(
                processQueryResultsAction({ exploreId, response: { data: series }, latency, datasourceId })
              );
            }
          },
        });

        const querySubscription = from(
          datasourceInstance.query(transaction.options, event => {
            datasourceUnsubscribe = event.unsubscribe;
            if (!streamHandler.closed) {
              // their might be a race condition when unsubscribing
              streamHandler.next(event);
            }
          })
        )
          .pipe(
            mergeMap(response => {
              eventBridge.emit('data-received', response.data || []);
              const latency = Date.now() - now;
              // Side-effect: Saving history in localstorage
              const nextHistory = updateHistory(history, datasourceId, queries);
              actions.push(historyUpdatedAction({ exploreId, history: nextHistory }));
              actions.push(processQueryResultsAction({ exploreId, response, latency, datasourceId }));

              return actions;
            }),
            catchError(err => {
              eventBridge.emit('data-error', err);
              actions.push(processQueryErrorsAction({ exploreId, response: err, datasourceId }));

              return actions;
            })
          )
          .subscribe({ next: action => outerObservable.next(action) });

        const unsubscribe = () => {
          if (datasourceUnsubscribe) {
            datasourceUnsubscribe();
          }
          querySubscription.unsubscribe();
          streamSubscription.unsubscribe();
          streamHandler.unsubscribe();
          outerObservable.unsubscribe();
        };

        return unsubscribe;
      });

      return observable.pipe(
        takeUntil(
          action$
            .ofType(
              runQueriesBatchAction.type,
              resetExploreAction.type,
              updateDatasourceInstanceAction.type,
              changeRefreshIntervalAction.type,
              clearQueriesAction.type
            )
            .pipe(
              filter(action => {
                if (action.type === resetExploreAction.type) {
                  return true; // stops all subscriptions if user navigates away
                }

                if (action.type === updateDatasourceInstanceAction.type && action.payload.exploreId === exploreId) {
                  return true; // stops subscriptions if user changes data source
                }

                if (action.type === changeRefreshIntervalAction.type && action.payload.exploreId === exploreId) {
                  return !isLive(action.payload.refreshInterval); // stops subscriptions if user changes refresh interval away from 'Live'
                }

                if (action.type === clearQueriesAction.type && action.payload.exploreId === exploreId) {
                  return true; // stops subscriptions if user clears all queries
                }

                return action.payload.exploreId === exploreId;
              })
            )
        )
      );
    })
  );
};
