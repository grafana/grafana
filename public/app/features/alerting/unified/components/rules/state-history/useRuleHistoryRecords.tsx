import { groupBy } from 'lodash';
import { useMemo } from 'react';

import {
  DataFrame,
  Field as DataFrameField,
  DataFrameJSON,
  FieldType,
  GrafanaTheme2,
  getDisplayProcessor,
} from '@grafana/data';
import { fieldIndexComparer } from '@grafana/data/internal';
import { MappingType, ThresholdsMode } from '@grafana/schema';
import { useTheme2 } from '@grafana/ui';

import { labelsMatchMatchers } from '../../../utils/alertmanager';
import { parsePromQLStyleMatcherLooseSafe } from '../../../utils/matchers';

import { Line, LogRecord, extractCommonLabels, omitLabels } from './common';

export function useRuleHistoryRecords(stateHistory?: DataFrameJSON, filter?: string) {
  const theme = useTheme2();

  return useMemo(() => {
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

    // CommonLabels should not be affected by the filter
    // find common labels so we can extract those from the instances
    const groupLabels = Object.keys(logRecordsByInstance);
    const groupLabelsArray: Array<Array<[string, string]>> = groupLabels.map((label) => {
      return Object.entries(JSON.parse(label));
    });

    const commonLabels = extractCommonLabels(groupLabelsArray);

    const filterMatchers = filter ? parsePromQLStyleMatcherLooseSafe(filter) : [];
    const filteredGroupedLines = Object.entries(logRecordsByInstance).filter(([key]) => {
      const labels = JSON.parse(key);
      return labelsMatchMatchers(labels, filterMatchers);
    });

    const dataFrames: DataFrame[] = filteredGroupedLines.map<DataFrame>(([key, records]) => {
      return logRecordsToDataFrame(key, records, commonLabels, theme);
    });

    return {
      historyRecords: logRecords.filter(({ line }) => line.labels && labelsMatchMatchers(line.labels, filterMatchers)),
      dataFrames,
      commonLabels,
      totalRecordsCount: logRecords.length,
    };
  }, [stateHistory, filter, theme]);
}

export function isNumbers(value: unknown[]): value is number[] {
  return value.every((v) => typeof v === 'number');
}

export function isLine(value: unknown): value is Line {
  return typeof value === 'object' && value !== null && 'current' in value && 'previous' in value;
}

// Each alert instance is represented by a data frame
// Each frame consists of two fields: timestamp and state change
export function logRecordsToDataFrame(
  instanceLabels: string,
  records: LogRecord[],
  commonLabels: Array<[string, string]>,
  theme: GrafanaTheme2
): DataFrame {
  const parsedInstanceLabels = Object.entries<string>(JSON.parse(instanceLabels));

  // There is an artificial element at the end meaning Date.now()
  // It exist to draw the state change from when it happened to the current time
  const timeField: DataFrameField = {
    name: 'time',
    type: FieldType.time,
    values: [...records.map((record) => record.timestamp), Date.now()],
    config: { displayName: 'Time', custom: { fillOpacity: 100 } },
  };

  const timeIndex = timeField.values.map((_, index) => index);
  timeIndex.sort(fieldIndexComparer(timeField));

  const stateValues = [...records.map((record) => record.line.current), records.at(-1)?.line.current];

  const frame: DataFrame = {
    fields: [
      {
        ...timeField,
        values: timeField.values.map((_, i) => timeField.values[timeIndex[i]]),
      },
      {
        name: 'State',
        type: FieldType.string,
        values: stateValues.map((_, i) => stateValues[timeIndex[i]]),
        config: {
          displayName: omitLabels(parsedInstanceLabels, commonLabels)
            .map(([key, label]) => `${key}=${label}`)
            .join(', '),
          color: { mode: 'thresholds' },
          custom: { fillOpacity: 100 },
          mappings: [
            {
              type: MappingType.RegexToText,
              options: {
                //  Map as a regex so we capture `Normal`, and `Normal (Updated)`
                pattern: '/^normal/i',
                result: { color: theme.colors.success.main },
              },
            },
            {
              type: MappingType.RegexToText,
              options: {
                pattern: '/Alerting/',
                result: { color: theme.colors.error.main },
              },
            },
            {
              type: MappingType.ValueToText,
              options: {
                Pending: {
                  color: theme.colors.warning.main,
                },
                Recovering: {
                  color: theme.colors.warning.main,
                },
                NoData: {
                  color: theme.colors.info.main,
                },
              },
            },
          ],
          thresholds: {
            mode: ThresholdsMode.Absolute,
            steps: [],
          },
        },
      },
    ],
    length: timeField.values.length,
    name: instanceLabels,
  };

  frame.fields.forEach((field) => {
    field.display = getDisplayProcessor({ field, theme });
  });

  return frame;
}
