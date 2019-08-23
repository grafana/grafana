import { Epic } from 'redux-observable';
import { flatMap, groupBy, values } from 'lodash';
import { bufferTime, mergeMap } from 'rxjs/operators';
import { from } from 'rxjs';
import { DataFrame, LoadingState } from '@grafana/data';

import { StoreState } from 'app/types';
import { ActionOf } from '../../../../core/redux';
import {
  LimitMessageRatePayload,
  limitMessageRatePayloadAction,
  processQueryResultsAction,
  ProcessQueryResultsPayload,
} from '../actionTypes';
import { EpicDependencies } from 'app/store/configureStore';

/**
 * Epic that tries to deal with performance problems of showing stream with too much through put. In live tail right now
 * we show max 1000 lines of logs, so if there is high through put there is not point in passing on too much data anyway
 * and also too high refresh rate on rendering would slow down all the interactions.
 *
 * Right now this tries to buffer the messages in some time frame while capping the buffer and throwing away excess
 * messages that we would not render anyway.
 *
 * TODO: Ideally this would be somehow adaptive, we probably can append single lines in bit higher refresh rate than if
 * we have to render 1000 lines every few milliseconds for example.
 *
 * @param action$
 */
export const limitMessageRateEpic: Epic<ActionOf<any>, ActionOf<any>, StoreState, EpicDependencies> = action$ => {
  return action$.ofType(limitMessageRatePayloadAction.type).pipe(
    bufferTime(2000),
    mergeMap((actions: Array<ActionOf<LimitMessageRatePayload>>) => {
      // There can be two different live tailing windows so need to split and group the messages accordingly
      const grouped = groupBy(actions, (action: ActionOf<LimitMessageRatePayload>) => action.payload.exploreId);
      const resultActions = values(grouped).map(mapToProcessQueryResultsAction);
      return from(resultActions);
    })
  );
};

/**
 * Map actions to processQueryResultsAction, while trying to imperfectly cap the number of rows, passed on to the final
 * processing.
 * @param actions
 */
const mapToProcessQueryResultsAction = (
  actions: Array<ActionOf<LimitMessageRatePayload>>
): ActionOf<ProcessQueryResultsPayload> => {
  const { datasourceId, exploreId } = actions[0].payload;
  // We cap to 1000 because that is the number of rows that live tailing shows at max.
  // This is just approximate, the dataframes are merged and sliced later on when processing the result in different
  // epic.
  const delta = capDataFrameRows(1000, flatMap(actions.map(actions => actions.payload.series)));

  return processQueryResultsAction({
    exploreId,
    latency: 0,
    datasourceId,
    loadingState: LoadingState.Streaming,
    series: null,
    delta,
  });
};

/**
 * Given array of DataFrames return smaller list of data frames which summed row count is just over the or equal the
 * rows param. This does not give exact row count, for that we would need to merge and slice the DataFrames.
 * @param rows
 * @param dataFrames
 */
const capDataFrameRows = (rows: number, dataFrames: DataFrame[]): DataFrame[] => {
  let accumulatorCount = 0;
  const accumulator = [];
  for (const df of dataFrames) {
    if (accumulatorCount < rows) {
      accumulator.push(df);
      accumulatorCount += df.length;
    }
  }
  return accumulator;
};
