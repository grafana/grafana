import { Epic } from 'redux-observable';
import { NEVER, from, Observable, Subject } from 'rxjs';
import { mergeMap, catchError, takeUntil, filter } from 'rxjs/operators';

import { ActionOf, actionCreatorFactory } from 'app/core/redux/actionCreatorFactory';
import { StoreState } from 'app/types/store';
import { ExploreId, QueryOptions } from 'app/types/explore';
import { hasNonEmptyQuery, buildQueryTransaction, updateHistory } from 'app/core/utils/explore';
import {
  clearQueriesAction,
  historyUpdatedAction,
  resetExploreAction,
  updateDatasourceInstanceAction,
  changeRefreshIntervalAction,
} from './actionTypes';
import { stateSaveAction } from './stateSaveEpic';
import { processQueryResultsAction } from './processQueryResultsEpic';
import { processQueryErrorsAction } from './processQueryErrorsEpic';
import { DataStreamState, LoadingState } from '@grafana/ui';
import { isLive } from '@grafana/ui/src/components/RefreshPicker/RefreshPicker';

export interface RunQueriesPayload {
  exploreId: ExploreId;
}

export interface RunQueriesBatchPayload {
  exploreId: ExploreId;
  queryOptions: QueryOptions;
}

export interface QueryStartPayload {
  exploreId: ExploreId;
}

export const runQueriesAction = actionCreatorFactory<RunQueriesPayload>('explore/RUN_QUERIES').create();

export const runQueriesBatchAction = actionCreatorFactory<RunQueriesBatchPayload>('explore/RUN_QUERIES_BATCH').create();

export const queryStartAction = actionCreatorFactory<QueryStartPayload>('explore/QUERY_START').create();

export const runQueriesEpic: Epic<ActionOf<any>, ActionOf<any>, StoreState> = (action$, state$) => {
  return action$.ofType(runQueriesAction.type).pipe(
    mergeMap((action: ActionOf<RunQueriesPayload>) => {
      const { exploreId } = action.payload;
      const { datasourceInstance, queries, datasourceError, containerWidth, refreshInterval } = state$.value.explore[
        exploreId
      ];

      if (datasourceError) {
        // let's not run any queries if data source is in a faulty state
        return NEVER;
      }

      if (!hasNonEmptyQuery(queries)) {
        return [clearQueriesAction({ exploreId }), stateSaveAction()]; // Remember to save to state and update location
      }

      // Some datasource's query builders allow per-query interval limits,
      // but we're using the datasource interval limit for now
      const interval = datasourceInstance.interval;
      const live = datasourceInstance && datasourceInstance.supportsStreaming && isLive(refreshInterval) ? true : false;

      return [
        runQueriesBatchAction({ exploreId, queryOptions: { interval, maxDataPoints: containerWidth, live } }),
        stateSaveAction(),
      ];
    })
  );
};

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

            if (state === LoadingState.Done) {
              eventBridge.emit('data-received', series || []);
              outerObservable.next(
                processQueryResultsAction({ exploreId, response: series, latency: 0, datasourceId })
              );
            }
          },
        });

        const querySubscription = from(
          datasourceInstance.query(transaction.options, event => {
            datasourceUnsubscribe = event.unsubscribe;
            streamHandler.next(event);
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
          console.log('Stopping Subscription', exploreId);
          querySubscription.unsubscribe();
          streamHandler.unsubscribe();
          streamSubscription.unsubscribe();
          outerObservable.unsubscribe();
          if (datasourceUnsubscribe) {
            datasourceUnsubscribe();
          }
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
