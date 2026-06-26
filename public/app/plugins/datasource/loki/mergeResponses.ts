import {
  closestIdx,
  DataFrame,
  DataFrameType,
  DataQueryResponse,
  DataQueryResponseData,
  Field,
  FieldType,
  LoadingState,
  QueryResultMetaStat,
  shallowCompare,
} from '@grafana/data';

import { LOADING_FRAME_NAME } from './querySplitting';

export function combineResponses(currentResponse: DataQueryResponse | null, newResponse: DataQueryResponse) {
  if (!currentResponse) {
    return cloneQueryResponse(newResponse);
  }

  newResponse.data.forEach((newFrame) => {
    const currentFrame = currentResponse.data.find((frame) => shouldCombine(frame, newFrame));
    if (!currentFrame) {
      currentResponse.data.push(cloneDataFrame(newFrame));
      return;
    }
    mergeFrames(currentFrame, newFrame);
  });

  const mergedErrors = [...(currentResponse.errors ?? []), ...(newResponse.errors ?? [])];
  if (mergedErrors.length > 0) {
    currentResponse.errors = mergedErrors;
  }

  // the `.error` attribute is obsolete now,
  // but we have to maintain it, otherwise
  // some grafana parts do not behave well.
  // we just choose the old error, if it exists,
  // otherwise the new error, if it exists.
  const mergedError = currentResponse.error ?? newResponse.error;
  if (mergedError != null) {
    currentResponse.error = mergedError;
  }

  const mergedTraceIds = [...(currentResponse.traceIds ?? []), ...(newResponse.traceIds ?? [])];
  if (mergedTraceIds.length > 0) {
    currentResponse.traceIds = mergedTraceIds;
  }

  return currentResponse;
}

/**
 * Given an existing DataQueryResponse, replace any data frame present in newResponse with those in newResponse
 */
export function replaceResponses(currentResponse: DataQueryResponse | null, newResponse: DataQueryResponse) {
  if (!currentResponse) {
    return cloneQueryResponse(newResponse);
  }

  newResponse.data.forEach((newFrame) => {
    const currentFrameIndex = currentResponse.data.findIndex((frame) => shouldCombine(frame, newFrame));
    if (currentFrameIndex < 0) {
      currentResponse.data.push(cloneDataFrame(newFrame));
      return;
    }
    currentResponse.data[currentFrameIndex] = newFrame;
  });

  // Clean up loading frame when newResponse contains the final response
  if (newResponse.state === LoadingState.Done) {
    currentResponse.data = currentResponse.data.filter((frame) => frame.name !== LOADING_FRAME_NAME);
  }

  const mergedErrors = [...(currentResponse.errors ?? []), ...(newResponse.errors ?? [])];
  if (mergedErrors.length > 0) {
    currentResponse.errors = mergedErrors;
  }

  const mergedError = currentResponse.error ?? newResponse.error;
  if (mergedError != null) {
    currentResponse.error = mergedError;
  }

  const mergedTraceIds = [...(currentResponse.traceIds ?? []), ...(newResponse.traceIds ?? [])];
  if (mergedTraceIds.length > 0) {
    currentResponse.traceIds = mergedTraceIds;
  }

  return currentResponse;
}

/**
 * Given two data frames, merge their values. Overlapping values will be added together.
 */
export function mergeFrames(dest: DataFrame, source: DataFrame) {
  const destTimeField = dest.fields.find((field) => field.type === FieldType.time);
  const destIdField = dest.fields.find((field) => field.type === FieldType.string && field.name === 'id');
  const sourceTimeField = source.fields.find((field) => field.type === FieldType.time);
  const sourceIdField = source.fields.find((field) => field.type === FieldType.string && field.name === 'id');

  if (!destTimeField || !sourceTimeField) {
    console.error(new Error(`Time fields not found in the data frames`));
    return;
  }

  const sourceTimeValues = sourceTimeField?.values.slice(0) ?? [];
  const totalFields = Math.max(dest.fields.length, source.fields.length);

  for (let i = 0; i < sourceTimeValues.length; i++) {
    const destIdx = resolveIdx(destTimeField, sourceTimeField, i);

    const entryExistsInDest = compareEntries(destTimeField, destIdField, destIdx, sourceTimeField, sourceIdField, i);

    for (let f = 0; f < totalFields; f++) {
      // For now, skip undefined fields that exist in the new frame
      if (!dest.fields[f]) {
        continue;
      }
      // Index is not reliable when frames have disordered fields, or an extra/missing field, so we find them by name.
      // If the field has no name, we fallback to the old index version.
      const sourceField = findSourceField(dest.fields[f], source.fields, f);
      if (!sourceField) {
        continue;
      }
      // Same value, accumulate
      if (entryExistsInDest) {
        if (dest.fields[f].type === FieldType.time) {
          // Time already exists, skip
          continue;
        } else if (dest.fields[f].type === FieldType.number) {
          // Number, add
          dest.fields[f].values[destIdx] = (dest.fields[f].values[destIdx] ?? 0) + sourceField.values[i];
        } else if (dest.fields[f].type === FieldType.other) {
          // Possibly labels, combine
          if (typeof sourceField.values[i] === 'object') {
            dest.fields[f].values[destIdx] = {
              ...dest.fields[f].values[destIdx],
              ...sourceField.values[i],
            };
          } else if (sourceField.values[i]) {
            dest.fields[f].values[destIdx] = sourceField.values[i];
          }
        } else {
          // Replace value
          dest.fields[f].values[destIdx] = sourceField.values[i];
        }
      } else if (sourceField.values[i] !== undefined) {
        // Insert in the `destIdx` position
        dest.fields[f].values.splice(destIdx, 0, sourceField.values[i]);
        if (sourceField.nanos) {
          dest.fields[f].nanos = dest.fields[f].nanos ?? new Array(dest.fields[f].values.length - 1).fill(0);
          dest.fields[f].nanos?.splice(destIdx, 0, sourceField.nanos[i]);
        } else if (dest.fields[f].nanos) {
          dest.fields[f].nanos?.splice(destIdx, 0, 0);
        }
      }
    }
  }

  dest.length = dest.fields[0].values.length;

  dest.meta = {
    ...dest.meta,
    stats: getCombinedMetadataStats(dest.meta?.stats ?? [], source.meta?.stats ?? []),
  };
}

function resolveIdx(destField: Field, sourceField: Field, index: number) {
  const idx = closestIdx(sourceField.values[index], destField.values);
  if (idx < 0) {
    return 0;
  }
  if (sourceField.values[index] === destField.values[idx] && sourceField.nanos && destField.nanos) {
    return sourceField.nanos[index] > destField.nanos[idx] ? idx + 1 : idx;
  }
  if (sourceField.values[index] > destField.values[idx]) {
    return idx + 1;
  }
  return idx;
}

function compareEntries(
  destTimeField: Field,
  destIdField: Field | undefined,
  destIndex: number,
  sourceTimeField: Field,
  sourceIdField: Field | undefined,
  sourceIndex: number
) {
  const sameTimestamp = compareNsTimestamps(destTimeField, destIndex, sourceTimeField, sourceIndex);
  if (!sameTimestamp) {
    return false;
  }
  if (!destIdField || !sourceIdField) {
    return true;
  }
  // Log frames, check indexes
  return (
    destIdField.values[destIndex] !== undefined && destIdField.values[destIndex] === sourceIdField.values[sourceIndex]
  );
}

function compareNsTimestamps(destField: Field, destIndex: number, sourceField: Field, sourceIndex: number) {
  if (destField.nanos && sourceField.nanos) {
    return (
      destField.values[destIndex] !== undefined &&
      destField.values[destIndex] === sourceField.values[sourceIndex] &&
      destField.nanos[destIndex] !== undefined &&
      destField.nanos[destIndex] === sourceField.nanos[sourceIndex]
    );
  }
  return destField.values[destIndex] !== undefined && destField.values[destIndex] === sourceField.values[sourceIndex];
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
const EXEC_TIME_STAT = 'Summary: exec time';
// This is specific for Loki
function getCombinedMetadataStats(
  destStats: QueryResultMetaStat[],
  sourceStats: QueryResultMetaStat[]
): QueryResultMetaStat[] {
  // in the current approach, we only handle a single stat
  const stats: QueryResultMetaStat[] = [];
  for (const stat of [TOTAL_BYTES_STAT, EXEC_TIME_STAT]) {
    const destStat = destStats.find((s) => s.displayName === stat);
    const sourceStat = sourceStats.find((s) => s.displayName === stat);

    if (sourceStat != null && destStat != null) {
      stats.push({ value: sourceStat.value + destStat.value, displayName: stat, unit: destStat.unit });
      continue;
    }

    // maybe one of them exist
    const eitherStat = sourceStat ?? destStat;
    if (eitherStat != null) {
      stats.push(eitherStat);
    }
  }
  return stats;
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
