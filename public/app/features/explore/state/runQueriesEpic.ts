import { Epic } from 'redux-observable';
import { NEVER, from } from 'rxjs';
import { mergeMap, catchError } from 'rxjs/operators';

import { ActionOf, actionCreatorFactory } from 'app/core/redux/actionCreatorFactory';
import { StoreState } from 'app/types/store';
import { ExploreId, ResultType, QueryOptions, ExploreMode } from 'app/types/explore';
import { hasNonEmptyQuery, buildQueryTransaction, updateHistory } from 'app/core/utils/explore';
import { clearQueriesAction, queryStartAction, historyUpdatedAction } from './actionTypes';
import { stateSaveAction } from './stateSaveEpic';
import { startSubscriptionsAction, subscriptionDataReceivedAction } from './epics';
import { processQueryResultsAction } from './processQueryResultsEpic';
import { processQueryErrorsAction } from './processQueryErrorsEpic';

export interface RunQueriesPayload {
  exploreId: ExploreId;
}

export interface RunQueriesForTypePayload {
  exploreId: ExploreId;
  resultType: ResultType;
  queryOptions: QueryOptions;
}

export const runQueriesAction = actionCreatorFactory<RunQueriesPayload>('explore/RUN_QUERIES').create();
export const runQueriesForTypeAction = actionCreatorFactory<RunQueriesForTypePayload>(
  'explore/RUN_QUERIES_FOR_TYPE'
).create();

export const runQueriesEpic: Epic<ActionOf<any>, ActionOf<any>, StoreState> = (action$, state$) => {
  return action$.ofType(runQueriesAction.type).pipe(
    mergeMap((action: ActionOf<RunQueriesPayload>) => {
      const { exploreId } = action.payload;
      const {
        datasourceInstance,
        queries,
        showingGraph,
        showingTable,
        datasourceError,
        containerWidth,
        mode,
      } = state$.value.explore[exploreId];

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

      // Keep table queries first since they need to return quickly
      const actions: Array<ActionOf<RunQueriesForTypePayload>> = [];
      if (showingTable && mode === ExploreMode.Metrics) {
        actions.push(
          runQueriesForTypeAction({
            exploreId,
            resultType: 'Table',
            queryOptions: {
              interval,
              format: 'table',
              instant: true,
              valueWithRefId: true,
            },
          })
        );
      }

      if (showingGraph && mode === ExploreMode.Metrics) {
        actions.push(
          runQueriesForTypeAction({
            exploreId,
            resultType: 'Graph',
            queryOptions: {
              interval,
              format: 'time_series',
              instant: false,
              maxDataPoints: containerWidth,
            },
          })
        );
      }

      if (mode === ExploreMode.Logs) {
        actions.push(
          runQueriesForTypeAction({ exploreId, resultType: 'Logs', queryOptions: { interval, format: 'logs' } })
        );
      }

      actions.push(stateSaveAction());

      return actions;
    })
  );
};

export const runQueriesForTypeEpic: Epic<ActionOf<any>, ActionOf<any>, StoreState> = (action$, state$) => {
  return action$.ofType(runQueriesForTypeAction.type).pipe(
    mergeMap((action: ActionOf<RunQueriesForTypePayload>) => {
      const { exploreId, resultType, queryOptions } = action.payload;
      const {
        datasourceInstance,
        eventBridge,
        queries,
        queryIntervals,
        range,
        scanning,
        history,
      } = state$.value.explore[exploreId];

      const actions: Array<ActionOf<any>> = [];

      if (resultType === 'Logs' && datasourceInstance.convertToStreamTargets) {
        actions.push(
          startSubscriptionsAction({
            exploreId,
            dataReceivedActionCreator: subscriptionDataReceivedAction,
          })
        );
      }

      const datasourceId = datasourceInstance.meta.id;
      const transaction = buildQueryTransaction(queries, resultType, queryOptions, range, queryIntervals, scanning);
      actions.push(queryStartAction({ exploreId, resultType, rowIndex: 0, transaction }));
      const now = Date.now();
      return from(datasourceInstance.query(transaction.options)).pipe(
        mergeMap(response => {
          eventBridge.emit('data-received', response.data || []);
          const latency = Date.now() - now;
          // Side-effect: Saving history in localstorage
          const nextHistory = updateHistory(history, datasourceId, queries);
          actions.push(historyUpdatedAction({ exploreId, history: nextHistory }));
          actions.push(processQueryResultsAction({ exploreId, response, latency, resultType, datasourceId }));

          return actions;
        }),
        catchError(err => {
          eventBridge.emit('data-error', err);
          actions.push(processQueryErrorsAction({ exploreId, response: err, resultType, datasourceId }));

          return actions;
        })
      );
    })
  );
};
