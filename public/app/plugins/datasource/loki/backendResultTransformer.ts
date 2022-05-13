import { DataQueryResponse, DataFrame, isDataFrame, FieldType, QueryResultMeta } from '@grafana/data';

import { getDerivedFields } from './getDerivedFields';
import { makeTableFrames } from './makeTableFrames';
import { formatQuery, getHighlighterExpressionsFromQuery } from './query_utils';
import { DerivedFieldConfig, LokiQuery, LokiQueryType } from './types';

function isMetricFrame(frame: DataFrame): boolean {
  return frame.fields.every((field) => field.type === FieldType.time || field.type === FieldType.number);
}

// returns a new frame, with meta merged with it's original meta
function setFrameMeta(frame: DataFrame, meta: QueryResultMeta): DataFrame {
  const { meta: oldMeta, ...rest } = frame;
  // meta maybe be undefined, we need to handle that
  const newMeta = { ...oldMeta, ...meta };
  return {
    ...rest,
    meta: newMeta,
  };
}

function processStreamFrame(
  frame: DataFrame,
  query: LokiQuery | undefined,
  derivedFieldConfigs: DerivedFieldConfig[]
): DataFrame {
  const meta: QueryResultMeta = {
    preferredVisualisationType: 'logs',
    limit: query?.maxLines,
    searchWords: query !== undefined ? getHighlighterExpressionsFromQuery(formatQuery(query.expr)) : undefined,
    custom: {
      // used by logs_model
      lokiQueryStatKey: 'Summary: total bytes processed',
    },
  };

  const newFrame = setFrameMeta(frame, meta);
  const derivedFields = getDerivedFields(newFrame, derivedFieldConfigs);
  return {
    ...newFrame,
    fields: [...newFrame.fields, ...derivedFields],
  };
}

function processStreamsFrames(
  frames: DataFrame[],
  queryMap: Map<string, LokiQuery>,
  derivedFieldConfigs: DerivedFieldConfig[]
): DataFrame[] {
  return frames.map((frame) => {
    const query = frame.refId !== undefined ? queryMap.get(frame.refId) : undefined;
    return processStreamFrame(frame, query, derivedFieldConfigs);
  });
}

function processMetricInstantFrames(frames: DataFrame[]): DataFrame[] {
  return frames.length > 0 ? makeTableFrames(frames) : [];
}

function processMetricRangeFrames(frames: DataFrame[]): DataFrame[] {
  const meta: QueryResultMeta = { preferredVisualisationType: 'graph' };
  return frames.map((frame) => setFrameMeta(frame, meta));
}

// we split the frames into 3 groups, because we will handle
// each group slightly differently
function groupFrames(
  frames: DataFrame[],
  queryMap: Map<string, LokiQuery>
): {
  streamsFrames: DataFrame[];
  metricInstantFrames: DataFrame[];
  metricRangeFrames: DataFrame[];
} {
  const streamsFrames: DataFrame[] = [];
  const metricInstantFrames: DataFrame[] = [];
  const metricRangeFrames: DataFrame[] = [];

  frames.forEach((frame) => {
    if (!isMetricFrame(frame)) {
      streamsFrames.push(frame);
    } else {
      const isInstantFrame = frame.refId != null && queryMap.get(frame.refId)?.queryType === LokiQueryType.Instant;
      if (isInstantFrame) {
        metricInstantFrames.push(frame);
      } else {
        metricRangeFrames.push(frame);
      }
    }
  });

  return { streamsFrames, metricInstantFrames, metricRangeFrames };
}

export function transformBackendResult(
  response: DataQueryResponse,
  queries: LokiQuery[],
  derivedFieldConfigs: DerivedFieldConfig[]
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

  const queryMap = new Map(queries.map((query) => [query.refId, query]));

  const { streamsFrames, metricInstantFrames, metricRangeFrames } = groupFrames(dataFrames, queryMap);

  return {
    ...rest,
    data: [
      ...processMetricRangeFrames(metricRangeFrames),
      ...processMetricInstantFrames(metricInstantFrames),
      ...processStreamsFrames(streamsFrames, queryMap, derivedFieldConfigs),
    ],
  };
}
