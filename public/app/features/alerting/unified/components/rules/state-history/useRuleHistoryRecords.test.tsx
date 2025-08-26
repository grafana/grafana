import { FieldType, createTheme } from '@grafana/data';

import { LogRecord } from './common';
import { logRecordsToDataFrame } from './useRuleHistoryRecords';

describe('logRecordsToDataFrame', () => {
  const theme = createTheme();

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

    expect(stateChangeField.name).toBe('State');
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
    expect(stateField.config.mappings).toHaveLength(3);
    expect(stateField.config.mappings![0].options).toMatchObject({
      pattern: '/^normal/i',
      result: { color: theme.colors.success.main },
    });
    expect(stateField.config.mappings![1].options).toMatchObject({
      pattern: '/Alerting/',
      result: { color: theme.colors.error.main },
    });
    expect(stateField.config.mappings![2].options).toMatchObject({
      Pending: {
        color: theme.colors.warning.main,
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
