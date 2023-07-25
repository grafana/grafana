import { groupBy, isEqual, uniqBy } from 'lodash';

import { DataFrame, DataFrameJSON } from '@grafana/data';
import { config } from '@grafana/runtime';
import { GrafanaAlertStateWithReason } from 'app/types/unified-alerting-dto';

import { isLine, isNumbers, logRecordsToDataFrameForPanel } from './useRuleHistoryRecords';

export interface Line {
  previous: GrafanaAlertStateWithReason;
  current: GrafanaAlertStateWithReason;
  values?: Record<string, number>;
  labels?: Record<string, string>;
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

export function getRuleHistoryRecordsForPanel(stateHistory?: DataFrameJSON) {
  if (!stateHistory) {
    return { dataFrames: [] };
  }
  const theme = config.theme2;
  // merge timestamp with "line"
  const tsValues = stateHistory?.data?.values[0] ?? [];
  const timestamps: number[] = isNumbers(tsValues) ? tsValues : [];
  const lines = stateHistory?.data?.values[1] ?? [];

  const logRecords = timestamps.reduce((acc: LogRecord[], timestamp: number, index: number) => {
    const line = lines[index];
    // values property can be undefined for some instance states (e.g. NoData)
    if (isLine(line)) {
      acc.push({ timestamp, line });
    }

    return acc;
  }, []);

  // group all records by alert instance (unique set of labels)
  const logRecordsByInstance = groupBy(logRecords, (record: LogRecord) => {
    return JSON.stringify(record.line.labels);
  });

  const groupedLines = Object.entries(logRecordsByInstance);

  const dataFrames: DataFrame[] = groupedLines.map<DataFrame>(([key, records]) => {
    return logRecordsToDataFrameForPanel(key, records, theme);
  });

  return {
    dataFrames,
  };
}
