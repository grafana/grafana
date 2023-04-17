import {
  ArrayVector,
  DataFrame,
  DataQueryResponse,
  DataQueryResponseData,
  Field,
  FieldType,
  isValidGoDuration,
  Labels,
  QueryResultMetaStat,
} from '@grafana/data';

import { isBytesString } from './languageUtils';
import { isLogLineJSON, isLogLineLogfmt, isLogLinePacked } from './lineParser';

export function dataFrameHasLokiError(frame: DataFrame): boolean {
  const labelSets: Labels[] = frame.fields.find((f) => f.name === 'labels')?.values.toArray() ?? [];
  return labelSets.some((labels) => labels.__error__ !== undefined);
}

export function dataFrameHasLevelLabel(frame: DataFrame): boolean {
  const labelSets: Labels[] = frame.fields.find((f) => f.name === 'labels')?.values.toArray() ?? [];
  return labelSets.some((labels) => labels.level !== undefined);
}

export function extractLogParserFromDataFrame(frame: DataFrame): {
  hasLogfmt: boolean;
  hasJSON: boolean;
  hasPack: boolean;
} {
  const lineField = frame.fields.find((field) => field.type === FieldType.string);
  if (lineField == null) {
    return { hasJSON: false, hasLogfmt: false, hasPack: false };
  }

  const logLines: string[] = lineField.values.toArray();

  let hasJSON = false;
  let hasLogfmt = false;
  let hasPack = false;

  logLines.forEach((line) => {
    if (isLogLineJSON(line)) {
      hasJSON = true;

      hasPack = isLogLinePacked(line);
    }
    if (isLogLineLogfmt(line)) {
      hasLogfmt = true;
    }
  });

  return { hasLogfmt, hasJSON, hasPack };
}

export function extractLabelKeysFromDataFrame(frame: DataFrame): string[] {
  const labelsArray: Array<{ [key: string]: string }> | undefined =
    frame?.fields?.find((field) => field.name === 'labels')?.values.toArray() ?? [];

  if (!labelsArray?.length) {
    return [];
  }

  return Object.keys(labelsArray[0]);
}

export function extractUnwrapLabelKeysFromDataFrame(frame: DataFrame): string[] {
  const labelsArray: Array<{ [key: string]: string }> | undefined =
    frame?.fields?.find((field) => field.name === 'labels')?.values.toArray() ?? [];

  if (!labelsArray?.length) {
    return [];
  }

  // We do this only for first label object, because we want to consider only labels that are present in all log lines
  // possibleUnwrapLabels are labels with 1. number value OR 2. value that is valid go duration OR 3. bytes string value
  const possibleUnwrapLabels = Object.keys(labelsArray[0]).filter((key) => {
    const value = labelsArray[0][key];
    if (!value) {
      return false;
    }
    return !isNaN(Number(value)) || isValidGoDuration(value) || isBytesString(value);
  });

  // Add only labels that are present in every line to unwrapLabels
  return possibleUnwrapLabels.filter((label) => labelsArray.every((obj) => obj[label]));
}

export function extractHasErrorLabelFromDataFrame(frame: DataFrame): boolean {
  const labelField = frame.fields.find((field) => field.name === 'labels' && field.type === FieldType.other);
  if (labelField == null) {
    return false;
  }

  const labels: Array<{ [key: string]: string }> = labelField.values.toArray();
  return labels.some((label) => label['__error__']);
}

export function extractLevelLikeLabelFromDataFrame(frame: DataFrame): string | null {
  const labelField = frame.fields.find((field) => field.name === 'labels' && field.type === FieldType.other);
  if (labelField == null) {
    return null;
  }

  // Depending on number of labels, this can be pretty heavy operation.
  // Let's just look at first 2 lines If needed, we can introduce more later.
  const labelsArray: Array<{ [key: string]: string }> = labelField.values.toArray().slice(0, 2);
  let levelLikeLabel: string | null = null;

  // Find first level-like label
  for (let labels of labelsArray) {
    const label = Object.keys(labels).find((label) => label === 'lvl' || label.includes('level'));
    if (label) {
      levelLikeLabel = label;
      break;
    }
  }
  return levelLikeLabel;
}

function shouldCombine(frame1: DataFrame, frame2: DataFrame): boolean {
  if (frame1.refId !== frame2.refId) {
    return false;
  }

  return frame1.name === frame2.name;
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
  const totalFields = dest.fields.length;
  for (let i = 0; i < totalFields; i++) {
    dest.fields[i].values = new ArrayVector(
      [].concat.apply(source.fields[i].values.toArray(), dest.fields[i].values.toArray())
    );
  }
  dest.length += source.length;
  dest.meta = {
    ...dest.meta,
    stats: getCombinedMetadataStats(dest.meta?.stats ?? [], source.meta?.stats ?? []),
  };
}

const TOTAL_BYTES_STAT = 'Summary: total bytes processed';

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
    fields: frame.fields.map((field: Field<unknown, ArrayVector>) => ({
      ...field,
      values: new ArrayVector(field.values.toArray()),
    })),
  };
}
