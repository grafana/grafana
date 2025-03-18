import {
  DataFrame,
  DataFrameType,
  DataQueryResponse,
  DataQueryResponseData,
  Field,
  FieldType,
  PanelData,
  QueryResultMetaStat,
  shallowCompare,
} from '@grafana/data';

export function combinePanelData(currentData: PanelData, newData: PanelData): PanelData {
  const series = combineResponses({ data: currentData.series }, { data: newData.series }).data;
  return { ...currentData, series };
}

export function combineResponses(currentResult: DataQueryResponse | null, newResult: DataQueryResponse) {
  if (!currentResult) {
    return cloneQueryResponse(newResult);
  }

  newResult.data.forEach((newFrame) => {
    const currentFrame = currentResult.data.find((frame) => shouldCombine(frame, newFrame));
    if (!currentFrame) {
      currentResult.data.push(cloneDataFrame(newFrame));
      return;
    }
    combineFrames(currentFrame, newFrame);
  });

  const mergedErrors = [...(currentResult.errors ?? []), ...(newResult.errors ?? [])];

  // we make sure to have `.errors` as undefined, instead of empty-array
  // when no errors.

  if (mergedErrors.length > 0) {
    currentResult.errors = mergedErrors;
  }

  // the `.error` attribute is obsolete now,
  // but we have to maintain it, otherwise
  // some grafana parts do not behave well.
  // we just choose the old error, if it exists,
  // otherwise the new error, if it exists.
  const mergedError = currentResult.error ?? newResult.error;
  if (mergedError != null) {
    currentResult.error = mergedError;
  }

  const mergedTraceIds = [...(currentResult.traceIds ?? []), ...(newResult.traceIds ?? [])];
  if (mergedTraceIds.length > 0) {
    currentResult.traceIds = mergedTraceIds;
  }

  return currentResult;
}

function combineFrames(dest: DataFrame, source: DataFrame) {
  // `dest` and `source` might have more or less fields, we need to go through all of them
  const totalFields = Math.max(dest.fields.length, source.fields.length);
  for (let i = 0; i < totalFields; i++) {
    // For now, skip undefined fields that exist in the new frame
    if (!dest.fields[i]) {
      continue;
    }
    // Index is not reliable when frames have disordered fields, or an extra/missing field, so we find them by name.
    // If the field has no name, we fallback to the old index version.
    const sourceField = findSourceField(dest.fields[i], source.fields, i);
    if (!sourceField) {
      continue;
    }
    dest.fields[i].values = [].concat.apply(sourceField.values, dest.fields[i].values);
    if (sourceField.nanos) {
      const nanos: number[] = dest.fields[i].nanos?.slice() || [];
      dest.fields[i].nanos = source.fields[i].nanos?.concat(nanos);
    }
  }
  dest.length += source.length;
  dest.meta = {
    ...dest.meta,
    stats: getCombinedMetadataStats(dest.meta?.stats ?? [], source.meta?.stats ?? []),
  };
}

function findSourceField(referenceField: Field, sourceFields: Field[], index: number) {
  const candidates = sourceFields.filter((f) => f.name === referenceField.name);

  if (candidates.length === 1) {
    return candidates[0];
  }

  if (referenceField.labels) {
    return candidates.find((candidate) => shallowCompare(referenceField.labels ?? {}, candidate.labels ?? {}));
  }

  return sourceFields[index];
}

const TOTAL_BYTES_STAT = 'Summary: total bytes processed';
// This is specific for Loki
function getCombinedMetadataStats(
  destStats: QueryResultMetaStat[],
  sourceStats: QueryResultMetaStat[]
): QueryResultMetaStat[] {
  // in the current approach, we only handle a single stat
  const destStat = destStats.find((s) => s.displayName === TOTAL_BYTES_STAT);
  const sourceStat = sourceStats.find((s) => s.displayName === TOTAL_BYTES_STAT);

  if (sourceStat != null && destStat != null) {
    return [{ value: sourceStat.value + destStat.value, displayName: TOTAL_BYTES_STAT, unit: destStat.unit }];
  }

  // maybe one of them exist
  const eitherStat = sourceStat ?? destStat;
  if (eitherStat != null) {
    return [eitherStat];
  }

  return [];
}

/**
 * Deep clones a DataQueryResponse
 */
export function cloneQueryResponse(response: DataQueryResponse): DataQueryResponse {
  const newResponse = {
    ...response,
    data: response.data.map(cloneDataFrame),
  };
  return newResponse;
}

function cloneDataFrame(frame: DataQueryResponseData): DataQueryResponseData {
  return {
    ...frame,
    fields: frame.fields.map((field: Field) => ({
      ...field,
      values: field.values,
    })),
  };
}

function shouldCombine(frame1: DataFrame, frame2: DataFrame): boolean {
  if (frame1.refId !== frame2.refId || frame1.name !== frame2.name) {
    return false;
  }

  const frameType1 = frame1.meta?.type;
  const frameType2 = frame2.meta?.type;

  if (frameType1 !== frameType2) {
    // we do not join things that have a different type
    return false;
  }

  // metric range query data
  if (frameType1 === DataFrameType.TimeSeriesMulti) {
    const field1 = frame1.fields.find((f) => f.type === FieldType.number);
    const field2 = frame2.fields.find((f) => f.type === FieldType.number);
    if (field1 === undefined || field2 === undefined) {
      // should never happen
      return false;
    }

    return shallowCompare(field1.labels ?? {}, field2.labels ?? {});
  }

  // logs query data
  // logs use a special attribute in the dataframe's "custom" section
  // because we do not have a good "frametype" value for them yet.
  const customType1 = frame1.meta?.custom?.frameType;
  const customType2 = frame2.meta?.custom?.frameType;
  // Legacy frames have this custom type
  if (customType1 === 'LabeledTimeValues' && customType2 === 'LabeledTimeValues') {
    return true;
  } else if (customType1 === customType2) {
    // Data plane frames don't
    return true;
  }

  // should never reach here
  return false;
}
