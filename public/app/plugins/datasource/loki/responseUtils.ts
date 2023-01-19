import { DataFrame, FieldType, isValidGoDuration, Labels } from '@grafana/data';

import { isBytesString } from './languageUtils';
import { isLogLineJSON, isLogLineLogfmt } from './lineParser';

export function dataFrameHasLokiError(frame: DataFrame): boolean {
  const labelSets: Labels[] = frame.fields.find((f) => f.name === 'labels')?.values.toArray() ?? [];
  return labelSets.some((labels) => labels.__error__ !== undefined);
}

export function dataFrameHasLevelLabel(frame: DataFrame): boolean {
  const labelSets: Labels[] = frame.fields.find((f) => f.name === 'labels')?.values.toArray() ?? [];
  return labelSets.some((labels) => labels.level !== undefined);
}

export function extractLogParserFromDataFrame(frame: DataFrame): { hasLogfmt: boolean; hasJSON: boolean } {
  const lineField = frame.fields.find((field) => field.type === FieldType.string);
  if (lineField == null) {
    return { hasJSON: false, hasLogfmt: false };
  }

  const logLines: string[] = lineField.values.toArray();

  let hasJSON = false;
  let hasLogfmt = false;

  logLines.forEach((line) => {
    if (isLogLineJSON(line)) {
      hasJSON = true;
    }
    if (isLogLineLogfmt(line)) {
      hasLogfmt = true;
    }
  });

  return { hasLogfmt, hasJSON };
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
