import _ from 'lodash';
import { Epic } from 'redux-observable';
import { mergeMap } from 'rxjs/operators';
import { NEVER } from 'rxjs';
import { LoadingState } from '@grafana/ui';

import { ActionOf } from 'app/core/redux/actionCreatorFactory';
import { StoreState } from 'app/types/store';
import { getRefIds } from 'app/core/utils/explore';
import {
  processQueryResultsAction,
  ProcessQueryResultsPayload,
  querySuccessAction,
  resetQueryErrorAction,
  scanStopAction,
  updateTimeRangeAction,
  runQueriesAction,
} from '../actionTypes';
import { ResultProcessor } from '../../utils/ResultProcessor';

export const processQueryResultsEpic: Epic<ActionOf<any>, ActionOf<any>, StoreState> = (
  action$,
  state$,
  { getTimeZone, getShiftedTimeRange }
) => {
  return action$.ofType(processQueryResultsAction.type).pipe(
    mergeMap((action: ActionOf<ProcessQueryResultsPayload>) => {
      const { exploreId, datasourceId, latency, loadingState, series, delta } = action.payload;
      const { datasourceInstance, scanning, eventBridge } = state$.value.explore[exploreId];

      // If datasource already changed, results do not matter
      if (datasourceInstance.meta.id !== datasourceId) {
        return NEVER;
      }

      const result = series || delta || [];
      const replacePreviousResults = loadingState === LoadingState.Done && series && !delta ? true : false;
      const resultProcessor = new ResultProcessor(state$.value.explore[exploreId], replacePreviousResults, result);
      const graphResult = resultProcessor.getGraphResult();
      const tableResult = resultProcessor.getTableResult();
      const logsResult = resultProcessor.getLogsResult();
      const refIds = getRefIds(result);
      const actions: Array<ActionOf<any>> = [];

      // For Angular editors
      eventBridge.emit('data-received', resultProcessor.getRawData());

      // Clears any previous errors that now have a successful query, important so Angular editors are updated correctly
      actions.push(
        resetQueryErrorAction({
          exploreId,
          refIds,
        })
      );

      actions.push(
        querySuccessAction({
          exploreId,
          latency,
          loadingState,
          graphResult,
          tableResult,
          logsResult,
        })
      );

      // Keep scanning for results if this was the last scanning transaction
      if (scanning) {
        if (_.size(result) === 0) {
          const range = getShiftedTimeRange(-1, state$.value.explore[exploreId].range, getTimeZone(state$.value.user));
          actions.push(updateTimeRangeAction({ exploreId, absoluteRange: range }));
          actions.push(runQueriesAction({ exploreId }));
        } else {
          // We can stop scanning if we have a result
          actions.push(scanStopAction({ exploreId }));
        }
      }

      return actions;
    })
  );
};
