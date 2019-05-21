import _ from 'lodash';
import { Epic } from 'redux-observable';
import { mergeMap } from 'rxjs/operators';
import { NEVER } from 'rxjs';
import { RawTimeRange } from '@grafana/ui/src/types/time';

import { ActionOf, actionCreatorFactory } from 'app/core/redux/actionCreatorFactory';
import { StoreState } from 'app/types/store';
import { ExploreId, ResultType } from 'app/types/explore';
import { getRefIds, makeTimeSeriesList } from 'app/core/utils/explore';

export interface ProcessQueryResultsPayload {
  exploreId: ExploreId;
  response: any;
  latency: number;
  resultType: ResultType;
  datasourceId: string;
}

export interface QuerySuccessPayload {
  exploreId: ExploreId;
  result: any;
  resultType: ResultType;
  latency: number;
}

export interface ScanRangePayload {
  exploreId: ExploreId;
  range: RawTimeRange;
}

export interface ScanStopPayload {
  exploreId: ExploreId;
}

export interface ResetQueryErrorPayload {
  exploreId: ExploreId;
  refIds: string[];
}

export const processQueryResultsAction = actionCreatorFactory<ProcessQueryResultsPayload>(
  'explore/PROCESS_QUERY_RESULTS'
).create();

/**
 * Complete a query transaction, mark the transaction as `done` and store query state in URL.
 * If the transaction was started by a scanner, it keeps on scanning for more results.
 */
export const querySuccessAction = actionCreatorFactory<QuerySuccessPayload>('explore/QUERY_SUCCESS').create();

export const scanRangeAction = actionCreatorFactory<ScanRangePayload>('explore/SCAN_RANGE').create();

/**
 * Stop any scanning for more results.
 */
export const scanStopAction = actionCreatorFactory<ScanStopPayload>('explore/SCAN_STOP').create();

export const resetQueryErrorAction = actionCreatorFactory<ResetQueryErrorPayload>('explore/RESET_QUERY_ERROR').create();

export const processQueryResultsEpic: Epic<ActionOf<any>, ActionOf<any>, StoreState> = (action$, state$) => {
  return action$.ofType(processQueryResultsAction.type).pipe(
    mergeMap((action: ActionOf<ProcessQueryResultsPayload>) => {
      const { exploreId, datasourceId, response, latency, resultType } = action.payload;
      const { datasourceInstance, scanning, scanner } = state$.value.explore[exploreId];

      // If datasource already changed, results do not matter
      if (datasourceInstance.meta.id !== datasourceId) {
        return NEVER;
      }

      const series: any[] = response.data;
      const refIds = getRefIds(series);
      const actions: Array<ActionOf<any>> = [];

      // Clears any previous errors that now have a successful query, important so Angular editors are updated correctly
      actions.push(
        resetQueryErrorAction({
          exploreId,
          refIds,
        })
      );

      const resultGetter =
        resultType === 'Graph' ? makeTimeSeriesList : resultType === 'Table' ? (data: any[]) => data : null;
      const result = resultGetter ? resultGetter(series, null, []) : series;

      actions.push(
        querySuccessAction({
          exploreId,
          result,
          resultType,
          latency,
        })
      );

      // Keep scanning for results if this was the last scanning transaction
      if (scanning) {
        if (_.size(result) === 0) {
          const range = scanner();
          actions.push(scanRangeAction({ exploreId, range }));
        } else {
          // We can stop scanning if we have a result
          actions.push(scanStopAction({ exploreId }));
        }
      }

      return actions;
    })
  );
};
