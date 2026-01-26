import { DataFrameJSON } from '@grafana/data';

import { Label, extractCommonLabels, historyDataFrameToLogRecords, omitLabels } from './common';

test('extractCommonLabels', () => {
  const labels: Label[][] = [
    [
      ['foo', 'bar'],
      ['baz', 'qux'],
    ],
    [
      ['foo', 'bar'],
      ['baz', 'qux'],
      ['potato', 'tomato'],
    ],
  ];

  expect(extractCommonLabels(labels)).toStrictEqual([
    ['foo', 'bar'],
    ['baz', 'qux'],
  ]);
});

test('extractCommonLabels with no common labels', () => {
  const labels: Label[][] = [[['foo', 'bar']], [['potato', 'tomato']]];

  expect(extractCommonLabels(labels)).toStrictEqual([]);
});

test('omitLabels', () => {
  const labels: Label[] = [
    ['foo', 'bar'],
    ['baz', 'qux'],
    ['potato', 'tomato'],
  ];
  const commonLabels: Label[] = [
    ['foo', 'bar'],
    ['baz', 'qux'],
  ];

  expect(omitLabels(labels, commonLabels)).toStrictEqual([['potato', 'tomato']]);
});

test('omitLabels with no common labels', () => {
  const labels: Label[] = [['potato', 'tomato']];
  const commonLabels: Label[] = [
    ['foo', 'bar'],
    ['baz', 'qux'],
  ];

  expect(omitLabels(labels, commonLabels)).toStrictEqual(labels);
});

describe('historyDataFrameToLogRecords', () => {
  test('should return empty array when stateHistory is undefined', () => {
    expect(historyDataFrameToLogRecords(undefined)).toEqual([]);
  });

  test('should return empty array when stateHistory.data is undefined', () => {
    const stateHistory: DataFrameJSON = {} as DataFrameJSON;
    expect(historyDataFrameToLogRecords(stateHistory)).toEqual([]);
  });

  test('should return empty array when stateHistory.data.values is empty', () => {
    const stateHistory: DataFrameJSON = {
      data: { values: [] },
      schema: { fields: [] },
    };
    expect(historyDataFrameToLogRecords(stateHistory)).toEqual([]);
  });

  test('should convert valid state history to log records', () => {
    const stateHistory: DataFrameJSON = {
      data: {
        values: [
          [1681739580000, 1681739590000, 1681739600000],
          [
            {
              previous: 'Normal',
              current: 'Alerting',
              values: { B: 1 },
              labels: { alertname: 'test-rule', grafana_folder: 'folder-one' },
            },
            {
              previous: 'Alerting',
              current: 'Normal',
              values: { B: 0 },
              labels: { alertname: 'test-rule', grafana_folder: 'folder-one' },
            },
            {
              previous: 'Normal',
              current: 'Pending',
              values: { B: 0.5 },
              labels: { alertname: 'test-rule', grafana_folder: 'folder-one' },
            },
          ],
        ],
      },
      schema: { fields: [] },
    };

    const result = historyDataFrameToLogRecords(stateHistory);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      timestamp: 1681739580000,
      line: {
        previous: 'Normal',
        current: 'Alerting',
        values: { B: 1 },
        labels: { alertname: 'test-rule', grafana_folder: 'folder-one' },
      },
    });
    expect(result[1]).toEqual({
      timestamp: 1681739590000,
      line: {
        previous: 'Alerting',
        current: 'Normal',
        values: { B: 0 },
        labels: { alertname: 'test-rule', grafana_folder: 'folder-one' },
      },
    });
    expect(result[2]).toEqual({
      timestamp: 1681739600000,
      line: {
        previous: 'Normal',
        current: 'Pending',
        values: { B: 0.5 },
        labels: { alertname: 'test-rule', grafana_folder: 'folder-one' },
      },
    });
  });

  test('should skip invalid line objects that are missing current or previous', () => {
    const stateHistory: DataFrameJSON = {
      data: {
        values: [
          [1681739580000, 1681739590000, 1681739600000],
          [
            {
              previous: 'Normal',
              current: 'Alerting',
              values: { B: 1 },
              labels: { alertname: 'test' },
            },
            {
              // Missing 'current' field - invalid
              previous: 'Alerting',
              values: { B: 0 },
              labels: { alertname: 'test' },
            },
            {
              previous: 'Normal',
              current: 'Pending',
              values: { B: 0.5 },
              labels: { alertname: 'test' },
            },
          ],
        ],
      },
      schema: { fields: [] },
    };

    const result = historyDataFrameToLogRecords(stateHistory);

    expect(result).toHaveLength(2);
    expect(result[0].timestamp).toBe(1681739580000);
    expect(result[1].timestamp).toBe(1681739600000);
  });

  test('should handle lines with empty values', () => {
    const stateHistory: DataFrameJSON = {
      data: {
        values: [
          [1681739580000],
          [
            {
              previous: 'Alerting',
              current: 'Normal',
              values: {},
              labels: { alertname: 'test' },
            },
          ],
        ],
      },
      schema: { fields: [] },
    };

    const result = historyDataFrameToLogRecords(stateHistory);

    expect(result).toHaveLength(1);
    expect(result[0].line.values).toEqual({});
  });
});
