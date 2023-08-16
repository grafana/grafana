import { createTheme, FieldType } from '@grafana/data';

import { LogRecord } from './common';
import { logRecordsToDataFrame, logRecordsToDataFrameForPanel } from './useRuleHistoryRecords';

const theme = createTheme();

describe('logRecordsToDataFrame', () => {
  it('should convert instance history records into a data frame', () => {
    const instanceLabels = { foo: 'bar', severity: 'critical', cluster: 'dev-us' };
    const records: LogRecord[] = [
      {
        timestamp: 1000000,
        line: { previous: 'Normal', current: 'Alerting', labels: instanceLabels },
      },
    ];

    const frame = logRecordsToDataFrame(JSON.stringify(instanceLabels), records, [], theme);

    expect(frame.fields).toHaveLength(2);

    const timeField = frame.fields[0];
    const stateChangeField = frame.fields[1];

    expect(timeField.name).toBe('time');
    expect(timeField.type).toBe(FieldType.time);

    expect(stateChangeField.name).toBe('state');
    expect(stateChangeField.type).toBe(FieldType.string);
    // There should be an artificial element at the end meaning Date.now()
    // It exist to draw the state change from when it happened to the current time
    expect(timeField.values).toHaveLength(2);
    expect(timeField.values[0]).toBe(1000000);

    expect(stateChangeField.values).toHaveLength(2);
    expect(stateChangeField.values).toEqual(['Alerting', 'Alerting']);
  });

  it('should configure value to color mappings', () => {
    const instanceLabels = { foo: 'bar', severity: 'critical', cluster: 'dev-us' };
    const records: LogRecord[] = [
      {
        timestamp: 1000000,
        line: { previous: 'Normal', current: 'Alerting', labels: instanceLabels },
      },
    ];

    const frame = logRecordsToDataFrame(JSON.stringify(instanceLabels), records, [], theme);

    const stateField = frame.fields[1];
    expect(stateField.config.mappings).toHaveLength(1);
    expect(stateField.config.mappings![0].options).toMatchObject({
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
    });
  });

  it('should return correct data frame summary', () => {
    const instanceLabels = { foo: 'bar', severity: 'critical', cluster: 'dev-us' };
    const records: LogRecord[] = [
      {
        timestamp: 1000000,
        line: { previous: 'Normal', current: 'Alerting', labels: instanceLabels },
      },
    ];

    const frame = logRecordsToDataFrame(JSON.stringify(instanceLabels), records, [], theme);

    expect(frame.fields).toHaveLength(2);
    expect(frame).toHaveLength(2);
  });

  it('should have only unique labels in display name', () => {
    const instanceLabels = { foo: 'bar', severity: 'critical', cluster: 'dev-us' };
    const records: LogRecord[] = [
      {
        timestamp: 1000000,
        line: { previous: 'Normal', current: 'Alerting', labels: instanceLabels },
      },
    ];

    const frame = logRecordsToDataFrame(
      JSON.stringify(instanceLabels),
      records,
      [
        ['foo', 'bar'],
        ['cluster', 'dev-us'],
      ],
      theme
    );

    expect(frame.fields[1].config.displayName).toBe('severity=critical');
  });
});

describe('logRecordsToDataFrameForPanel', () => {
  it('should return correct data frame records', () => {
    const instanceLabels = { foo: 'bar', severity: 'critical', cluster: 'dev-us' };
    const records: LogRecord[] = [
      {
        timestamp: 1000000,
        line: { previous: 'Normal', current: 'Alerting', labels: instanceLabels, values: { A: 10, B: 90 } },
      },
      {
        timestamp: 1000050,
        line: { previous: 'Alerting', current: 'Normal', labels: instanceLabels },
      },
    ];

    const frame = logRecordsToDataFrameForPanel(JSON.stringify(instanceLabels), records, theme);

    expect(frame.fields).toHaveLength(6);
    expect(frame).toHaveLength(2);
    expect(frame.fields[0]).toMatchObject({
      name: 'time',
      type: FieldType.time,
      values: [1000000, 1000050],
    });
    expect(frame.fields[1]).toMatchObject({
      name: 'alertId',
      type: FieldType.string,
      values: [1, 1],
    });
    expect(frame.fields[2]).toMatchObject({
      name: 'newState',
      type: FieldType.string,
      values: ['Alerting', 'Normal'],
    });
    expect(frame.fields[3]).toMatchObject({
      name: 'prevState',
      type: FieldType.string,
      values: ['Normal', 'Alerting'],
    });
    expect(frame.fields[4]).toMatchObject({
      name: 'color',
      type: FieldType.string,
      values: [theme.colors.error.main, theme.colors.success.main],
    });
    expect(frame.fields[5]).toMatchObject({
      name: 'data',
      type: FieldType.other,
      values: [
        [
          { metric: 'foo', value: 'bar' },
          { metric: 'severity', value: 'critical' },
          { metric: 'cluster', value: 'dev-us' },
          { metric: ' Values', value: '{A= 10, B= 90}' },
        ],
        [
          { metric: 'foo', value: 'bar' },
          { metric: 'severity', value: 'critical' },
          { metric: 'cluster', value: 'dev-us' },
          { metric: '', value: '' },
        ],
      ],
    });
  });
});
