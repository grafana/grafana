import { ActionsObservable, Epic } from 'redux-observable';
import { Observable, Subject } from 'rxjs';
import { mergeMap, catchError, takeUntil, filter } from 'rxjs/operators';
import { isLive } from '@grafana/ui/src/components/RefreshPicker/RefreshPicker';
import { DataStreamState, DataQueryResponse, DataQueryResponseData } from '@grafana/ui/src';

import { LoadingState, DataFrame } from '@grafana/data';

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
  stateSaveAction,
} from '../actionTypes';
import { ExploreId, ExploreItemState } from 'app/types';

const publishActions = (outerObservable: Subject<any>, actions: Array<ActionOf<any>>) => {
  for (const action of actions) {
    outerObservable.next(action);
  }
};

interface ProcessResponseConfig {
  exploreId: ExploreId;
  exploreItemState: ExploreItemState;
  datasourceId: string;
  now: number;
  loadingState: LoadingState;
  series?: DataQueryResponseData[];
  delta?: DataFrame[];
}

const processResponse = (config: ProcessResponseConfig) => {
  const { exploreId, exploreItemState, datasourceId, now, loadingState, series, delta } = config;
  const { queries, history } = exploreItemState;
  const latency = Date.now() - now;

  // Side-effect: Saving history in localstorage
  const nextHistory = updateHistory(history, datasourceId, queries);
  return [
    historyUpdatedAction({ exploreId, history: nextHistory }),
    processQueryResultsAction({ exploreId, latency, datasourceId, loadingState, series, delta }),
    stateSaveAction(),
  ];
};

interface ProcessErrorConfig {
  exploreId: ExploreId;
  datasourceId: string;
  error: any;
}

const processError = (config: ProcessErrorConfig) => {
  const { exploreId, datasourceId, error } = config;

  return [processQueryErrorsAction({ exploreId, response: error, datasourceId })];
};

export const runQueriesBatchEpic: Epic<ActionOf<any>, ActionOf<any>, StoreState> = (
  action$,
  state$,
  { getQueryResponse }
) => {
  return action$.ofType(runQueriesBatchAction.type).pipe(
    mergeMap((action: ActionOf<RunQueriesBatchPayload>) => {
      const { exploreId, queryOptions } = action.payload;
      const exploreItemState = state$.value.explore[exploreId];
      const { datasourceInstance, queries, queryIntervals, range, scanning } = exploreItemState;

      // Create an observable per run queries action
      // Within the observable create two subscriptions
      // First subscription: 'querySubscription' subscribes to the call to query method on datasource instance
      // Second subscription: 'streamSubscription' subscribes to events from the query methods observer callback
      const observable: Observable<ActionOf<any>> = Observable.create((outerObservable: Subject<any>) => {
        const datasourceId = datasourceInstance.meta.id;
        const transaction = buildQueryTransaction(queries, queryOptions, range, queryIntervals, scanning);
        outerObservable.next(queryStartAction({ exploreId }));

        const now = Date.now();
        let datasourceUnsubscribe: Function = null;
        const streamHandler = new Subject<DataStreamState>();
        const observer = (event: DataStreamState) => {
          datasourceUnsubscribe = event.unsubscribe;
          if (!streamHandler.closed) {
            // their might be a race condition when unsubscribing
            streamHandler.next(event);
          }
        };

        // observer subscription, handles datasourceInstance.query observer events and pushes that forward
        const streamSubscription = streamHandler.subscribe({
          next: event => {
            const { state, error, data, delta } = event;
            if (!data && !delta && !error) {
              return;
            }

            if (state === LoadingState.Error) {
              const actions = processError({ exploreId, datasourceId, error });
              publishActions(outerObservable, actions);
            }

            if (state === LoadingState.Streaming) {
              outerObservable.next(
                limitMessageRatePayloadAction({
                  exploreId,
                  series: delta,
                  datasourceId,
                })
              );
            }

            if (state === LoadingState.Done || state === LoadingState.Loading) {
              const actions = processResponse({
                exploreId,
                exploreItemState,
                datasourceId,
                now,
                loadingState: state,
                series: null,
                delta,
              });
              publishActions(outerObservable, actions);
            }
          },
        });

        // query subscription, handles datasourceInstance.query response and pushes that forward
        const querySubscription = getQueryResponse(datasourceInstance, transaction.options, observer)
          .pipe(
            mergeMap((response: DataQueryResponse) => {
              return processResponse({
                exploreId,
                exploreItemState,
                datasourceId,
                now,
                loadingState: LoadingState.Done,
                series: response && response.data ? response.data : [],
                delta: null,
              });
            }),
            catchError(error => {
              return processError({ exploreId, datasourceId, error });
            })
          )
          .subscribe({ next: (action: ActionOf<any>) => outerObservable.next(action) });

        // this unsubscribe method will be called when any of the takeUntil actions below happen
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

      const stopObservable$ = makeStopObservable(action$, exploreId);
      return observable.pipe(takeUntil(stopObservable$));
    })
  );
};

const makeStopObservable = (action$: ActionsObservable<ActionOf<any>>, exploreId: ExploreId) => {
  return action$
    .ofType(
      runQueriesBatchAction.type,
      resetExploreAction.type,
      // stops subscriptions if user changes data source
      updateDatasourceInstanceAction.type,
      changeRefreshIntervalAction.type,
      // stops subscriptions if user clears all queries
      clearQueriesAction.type
    )
    .pipe(
      filter(action => {
        if (action.type === resetExploreAction.type) {
          return true; // stops all subscriptions if user navigates away
        }

        if (action.payload.exploreId !== exploreId) {
          // Filter out actions which are not for current exploreId.
          return false;
        }

        if (action.type === changeRefreshIntervalAction.type) {
          return !isLive(action.payload.refreshInterval); // stops subscriptions if user changes refresh interval away from 'Live'
        }

        return true;
      })
    );
};
