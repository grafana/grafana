import { Epic } from 'redux-observable';
import { Observable, Subject } from 'rxjs';
import { mergeMap, catchError, takeUntil, filter } from 'rxjs/operators';
import _, { isString } from 'lodash';
import { isLive } from '@grafana/ui/src/components/RefreshPicker/RefreshPicker';
import {
  DataStreamState,
  LoadingState,
  DataQueryResponse,
  SeriesData,
  DataQueryResponseData,
  AbsoluteTimeRange,
} from '@grafana/ui';
import * as dateMath from '@grafana/ui/src/utils/datemath';

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
  changeRangeAction,
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
  delta?: SeriesData[];
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
      // First subscription: 'querySubscription' subscribes to the call to query method on datasourceinstance
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
            const { state, error, series, delta } = event;
            if (!series && !delta && !error) {
              return;
            }

            if (state === LoadingState.Error) {
              const actions = processError({ exploreId, datasourceId, error });
              publishActions(outerObservable, actions);
            }

            if (state === LoadingState.Streaming) {
              if (event.request && event.request.range) {
                let newRange = event.request.range;
                let absoluteRange: AbsoluteTimeRange = {
                  from: newRange.from.valueOf(),
                  to: newRange.to.valueOf(),
                };
                if (isString(newRange.raw.from)) {
                  newRange = {
                    from: dateMath.parse(newRange.raw.from, false),
                    to: dateMath.parse(newRange.raw.to, true),
                    raw: newRange.raw,
                  };
                  absoluteRange = {
                    from: newRange.from.valueOf(),
                    to: newRange.to.valueOf(),
                  };
                }
                outerObservable.next(changeRangeAction({ exploreId, range: newRange, absoluteRange }));
              }

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
