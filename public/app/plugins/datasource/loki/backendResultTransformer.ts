import { DataQueryRequest, DataQueryResponse, DataFrame, isDataFrame, FieldType } from '@grafana/data';
import { partition } from 'lodash';
import { LokiQuery, LokiQueryType } from './types';
import { makeTableFrames } from './makeTableFrames';

function isMetricFrame(frame: DataFrame): boolean {
  return frame.fields.every((field) => field.type === FieldType.time || field.type === FieldType.number);
}

export function transformBackendResult(
  response: DataQueryResponse,
  request: DataQueryRequest<LokiQuery>
): DataQueryResponse {
  const { data, ...rest } = response;

  // in the typescript type, data is an array of basically anything.
  // we do know that they have to be dataframes, so we make a quick check,
  // this way we can be sure, and also typescript is happy.
  const dataFrames = data.map((d) => {
    if (!isDataFrame(d)) {
      throw new Error('transformation only supports dataframe responses');
    }
    return d;
  });

  const instantRefIds = new Set(
    request.targets.filter((query) => query.queryType === LokiQueryType.Instant).map((query) => query.refId)
  );

  const [instantMetricFrames, normalFrames] = partition(dataFrames, (frame) => {
    const isInstantFrame = frame.refId != null && instantRefIds.has(frame.refId);
    return isInstantFrame && isMetricFrame(frame);
  });

  const tableFrames = instantMetricFrames.length > 0 ? makeTableFrames(instantMetricFrames) : [];

  return { ...rest, data: [...normalFrames, ...tableFrames] };
}
