import { groupBy } from 'lodash';
import { useMemo } from 'react';

import {
  DataFrame,
  DataFrameJSON,
  Field as DataFrameField,
  FieldType,
  getDisplayProcessor,
  GrafanaTheme2,
} from '@grafana/data';
import { fieldIndexComparer } from '@grafana/data/src/field/fieldComparers';
import { config } from '@grafana/runtime';
import { MappingType, ThresholdsMode } from '@grafana/schema';
import { OK_COLOR, useTheme2 } from '@grafana/ui';
import { normalizeAlertState } from 'app/features/alerting/state/alertDef';

import { labelsMatchMatchers, parseMatchers } from '../../../utils/alertmanager';

import { extractCommonLabels, Line, LogRecord, omitLabels } from './common';

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

    const filterMatchers = filter ? parseMatchers(filter) : [];
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

export function getRuleHistoryRecordsForPanel(stateHistory?: DataFrameJSON, filter?: string) {
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

  const filterMatchers = filter ? parseMatchers(filter) : [];
  const filteredGroupedLines = Object.entries(logRecordsByInstance).filter(([key]) => {
    const labels = JSON.parse(key);
    return labelsMatchMatchers(labels, filterMatchers);
  });

  const dataFrames: DataFrame[] = filteredGroupedLines.map<DataFrame>(([key, records]) => {
    return logRecordsToDataFrameForPanel(key, records, theme);
  });

  return {
    dataFrames,
  };
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
        name: 'state',
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
              type: MappingType.ValueToText,
              options: {
                Alerting: {
                  color: theme.colors.error.main,
                },
                Pending: {
                  color: theme.colors.warning.main,
                },
                Normal: {
                  color: theme.colors.success.main,
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

type Data = {
  metric: string;
  value: string;
};

function logRecordToData(record: LogRecord) {
  let labelsInLogs: Data[] = [];
  let valuesInLogs: Data = { metric: '', value: '' };
  if (record.line.labels) {
    const { labels } = record.line;
    const labelsArray = Object.entries(labels);
    labelsInLogs = labelsArray.map(([key, value]) => ({ metric: key, value }));
  }

  let values = record.line.values;
  if (values) {
    const valuesArray = Object.entries(values);
    const valuesData = valuesArray.map(([key, value]) => ({ metric: key, value: value.toString() }));
    //convert valuesInloGS to a one Data entry
    valuesInLogs = valuesData.reduce<Data>(
      (acc, cur) => {
        acc.value = acc.value.length > 0 ? acc.value + ', ' : acc.value;
        acc.value = cur.metric.length > 0 ? acc.value + cur.metric + '= ' + cur.value : acc.value;
        return acc;
      },
      { metric: ' Values', value: '' }
    );
    if (valuesInLogs.value.length > 0) {
      valuesInLogs.value = '{' + valuesInLogs.value + '}';
      return [...labelsInLogs, valuesInLogs];
    } else {
      return labelsInLogs;
    }
  }
  return [...labelsInLogs, valuesInLogs];
}

// Convert log records to data frame for panel
export function logRecordsToDataFrameForPanel(
  instanceLabels: string,
  records: LogRecord[],
  theme: GrafanaTheme2
): DataFrame {
  const timeField: DataFrameField = {
    name: 'time',
    type: FieldType.time,
    values: records.map((record) => record.timestamp),
    config: { displayName: 'Time', custom: { fillOpacity: 100 } },
  };

  const timeIndex = timeField.values.map((_, index) => index);
  timeIndex.sort(fieldIndexComparer(timeField));

  const frame: DataFrame = {
    fields: [
      {
        ...timeField,
        values: timeField.values.map((_, i) => timeField.values[timeIndex[i]]),
      },
      {
        name: 'alertId',
        type: FieldType.string,
        values: records.map((_) => 1),
        config: {
          displayName: 'AlertId',
          custom: { fillOpacity: 100 },
        },
      },
      {
        name: 'newState',
        type: FieldType.string,
        values: records.map((record) => record.line.current),
        config: {
          displayName: 'newState',
          custom: { fillOpacity: 100 },
        },
      },
      {
        name: 'prevState',
        type: FieldType.string,
        values: records.map((record) => record.line.previous),
        config: {
          displayName: 'prevState',
          custom: { fillOpacity: 100 },
        },
      },
      {
        name: 'color',
        type: FieldType.string,
        values: records.map((record) => {
          const normalizedState = normalizeAlertState(record.line.current);
          switch (normalizedState) {
            case 'firing':
            case 'alerting':
            case 'error':
              return theme.colors.error.main;
            case 'pending':
              return theme.colors.warning.main;
            case 'normal':
              return OK_COLOR; // I did not find the color for normal state(green) in Grafana theme
            case 'nodata':
              return theme.colors.info.main;
            case 'paused':
              return theme.colors.text.disabled;
            default:
              return theme.colors.info.main;
          }
        }),
        config: {},
      },
      {
        name: 'data',
        type: FieldType.other,
        values: records.map((record) => {
          return logRecordToData(record);
        }),
        config: {},
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
