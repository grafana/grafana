import { isEqual, uniqBy } from 'lodash';

import { DataFrameJSON } from '@grafana/data';
import { GrafanaAlertStateWithReason } from 'app/types/unified-alerting-dto';

export interface Line {
  previous: GrafanaAlertStateWithReason;
  current: GrafanaAlertStateWithReason;
  values?: Record<string, number>;
  labels?: Record<string, string>;
  fingerprint?: string;
  ruleUID?: string;
  error?: string;
}

export interface LogRecord {
  timestamp: number;
  line: Line;
}

export type Label = [string, string];

// omit "common" labels from "labels"
export function omitLabels(labels: Label[], common: Label[]): Label[] {
  return labels.filter((label) => {
    return !common.find((commonLabel) => JSON.stringify(commonLabel) === JSON.stringify(label));
  });
}

// find all common labels by looking at which ones occur in every record, then create a unique array of items for those
export function extractCommonLabels(labels: Label[][]): Label[] {
  const flatLabels = labels.flatMap((label) => label);

  const commonLabels = uniqBy(
    flatLabels.filter((label) => {
      const count = flatLabels.filter((l) => isEqual(label, l)).length;
      return count === Object.keys(labels).length;
    }),
    (label) => JSON.stringify(label)
  );

  return commonLabels;
}

export function historyDataFrameToLogRecords(stateHistory?: DataFrameJSON): LogRecord[] {
  if (!stateHistory?.data || !stateHistory.data.values || !Array.isArray(stateHistory.data.values)) {
    return [];
  }

  const [tsValues, lines] = stateHistory.data.values;

  if (!Array.isArray(tsValues) || !Array.isArray(lines) || tsValues.length !== lines.length) {
    return [];
  }

  const timestamps = isNumbers(tsValues) ? tsValues : [];

  // merge timestamp with "line"
  const logRecords = timestamps.reduce((acc: LogRecord[], timestamp: number, index: number) => {
    const line = lines[index];
    if (!isLine(line)) {
      return acc;
    }
    acc.push({ timestamp, line });
    return acc;
  }, []);

  return logRecords;
}

export function isNumbers(value: unknown[]): value is number[] {
  return value.every((v) => typeof v === 'number');
}

export function isLine(value: unknown): value is Line {
  return typeof value === 'object' && value !== null && 'current' in value && 'previous' in value;
}
