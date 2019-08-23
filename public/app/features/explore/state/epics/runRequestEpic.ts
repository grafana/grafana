import { Epic } from 'redux-observable';
import { Observable, from, Subscriber } from 'rxjs';
import { mergeMap, takeUntil, filter, catchError } from 'rxjs/operators';
import { isLive } from '@grafana/ui/src/components/RefreshPicker/RefreshPicker';

import { ActionOf } from 'app/core/redux/actionCreatorFactory';
import { StoreState } from 'app/types/store';
import {
  clearQueriesAction,
  resetExploreAction,
  updateDatasourceInstanceAction,
  changeRefreshIntervalAction,
  runQueriesBatchAction,
  RunQueriesBatchPayload,
  queryStartAction,
  historyUpdatedAction,
  processQueryResultsAction,
  stateSaveAction,
  processQueryErrorsAction,
  changeRangeAction,
  limitMessageRatePayloadAction,
  changeLoadingStateAction,
} from '../actionTypes';
import { buildQueryTransaction, updateHistory } from '../../../../core/utils/explore';
import { PanelQueryState } from '../../../dashboard/state/PanelQueryState';
import { DataQueryResponseData } from '@grafana/ui/src/types/datasource';
import { ExploreId, ExploreItemState } from 'app/types';
import { LoadingState, DataFrame, AbsoluteTimeRange, dateMath } from '@grafana/data';
import { PanelData } from '@grafana/ui/src/types/panel';
import { isString } from 'lodash';

const publishActions = (outerObservable: Subscriber<unknown>, actions: Array<ActionOf<any>>) => {
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

export const runRequestEpic: Epic<ActionOf<any>, ActionOf<any>, StoreState> = (
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
      const observable: Observable<ActionOf<any>> = new Observable(outerObservable => {
        outerObservable.next(queryStartAction({ exploreId }));

        const datasourceId = datasourceInstance.meta.id;
        const now = Date.now();
        const transaction = buildQueryTransaction(queries, queryOptions, range, queryIntervals, scanning);
        const queryState = new PanelQueryState();
        queryState.onStreamingDataUpdated = () => {
          const data = queryState.validateStreamsAndGetPanelData();
          const { state, error, request, series } = data;
          if (!data && !error) {
            return;
          }

          if (state === LoadingState.Error) {
            const actions = processError({ exploreId, datasourceId, error });
            publishActions(outerObservable, actions);
          }

          if (state === LoadingState.Streaming) {
            if (request && request.range) {
              let newRange = request.range;
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
                series,
                datasourceId,
              })
            );
          }

          if (state === LoadingState.Done) {
            outerObservable.next(changeLoadingStateAction({ exploreId, loadingState: state }));
          }
        };

        from(queryState.execute(datasourceInstance, transaction.options))
          .pipe(
            mergeMap((response: PanelData) => {
              return processResponse({
                exploreId,
                exploreItemState,
                datasourceId,
                now,
                loadingState: response.state,
                series: response && response.series ? response.series : [],
                delta: null,
              });
            }),
            catchError(error => {
              return processError({ exploreId, datasourceId, error });
            })
          )
          .subscribe({ next: (action: ActionOf<any>) => outerObservable.next(action) });

        const unsubscribe = () => {
          queryState.closeStreams(true);
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
