import { DataFrame, DataQueryResponse, FieldType, isValidGoDuration, Labels } from '@grafana/data';

import { isBytesString, processLabels } from './languageUtils';
import { isLogLineJSON, isLogLineLogfmt, isLogLinePacked } from './lineParser';
import { LabelType } from './types';

export function dataFrameHasLokiError(frame: DataFrame): boolean {
  const labelSets: Labels[] = frame.fields.find((f) => f.name === 'labels')?.values ?? [];
  return labelSets.some((labels) => labels.__error__ !== undefined);
}

export function dataFrameHasLevelLabel(frame: DataFrame): boolean {
  const labelSets: Labels[] = frame.fields.find((f) => f.name === 'labels')?.values ?? [];
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

  const logLines: string[] = lineField.values;

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

export function extractLabelKeysFromDataFrame(frame: DataFrame, type: LabelType = LabelType.Indexed): string[] {
  const labelsArray: Array<{ [key: string]: string }> | undefined =
    frame?.fields?.find((field) => field.name === 'labels')?.values ?? [];
  const labelTypeArray: Array<{ [key: string]: string }> | undefined =
    frame?.fields?.find((field) => field.name === 'labelTypes')?.values ?? [];

  if (!labelsArray?.length) {
    return [];
  }

  // if there are no label types and type is LabelType.Indexed return all label keys
  if (!labelTypeArray?.length) {
    if (type === LabelType.Indexed) {
      const { keys: labelKeys } = processLabels(labelsArray);
      return labelKeys;
    }
    return [];
  }

  // If we have label types, we can return only label keys that match type
  let labelsSet = new Set<string>();
  for (let i = 0; i < labelsArray.length; i++) {
    const labels = labelsArray[i];
    const labelsType = labelTypeArray[i];

    const allLabelKeys = Object.keys(labels).filter((key) => labelsType[key] === type);
    labelsSet = new Set([...labelsSet, ...allLabelKeys]);
  }

  return Array.from(labelsSet);
}

export function extractUnwrapLabelKeysFromDataFrame(frame: DataFrame): string[] {
  const labelsArray: Array<{ [key: string]: string }> | undefined =
    frame?.fields?.find((field) => field.name === 'labels')?.values ?? [];

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

  const labels: Array<{ [key: string]: string }> = labelField.values;
  return labels.some((label) => label['__error__']);
}

export function extractLevelLikeLabelFromDataFrame(frame: DataFrame): string | null {
  const labelField = frame.fields.find((field) => field.name === 'labels' && field.type === FieldType.other);
  if (labelField == null) {
    return null;
  }

  // Depending on number of labels, this can be pretty heavy operation.
  // Let's just look at first 2 lines If needed, we can introduce more later.
  const labelsArray: Array<{ [key: string]: string }> = labelField.values.slice(0, 2);
  let levelLikeLabel: string | null = null;

  // Find first level-like label
  for (let labels of labelsArray) {
    const label = Object.keys(labels).find(
      (label) => label === 'level' || label === 'detected_level' || label === 'lvl' || label.includes('level')
    );
    if (label) {
      levelLikeLabel = label;
      break;
    }
  }
  return levelLikeLabel;
}

export function isRetriableError(errorResponse: DataQueryResponse) {
  const message = errorResponse.errors
    ? (errorResponse.errors[0].message ?? '').toLowerCase()
    : (errorResponse.error?.message ?? '');
  if (message.includes('timeout')) {
    return true;
  } else if (errorResponse.data.length > 0 && errorResponse.data[0].fields.length > 0) {
    // Error response but we're receiving data, continue querying.
    return false;
  }
  throw new Error(message);
}
