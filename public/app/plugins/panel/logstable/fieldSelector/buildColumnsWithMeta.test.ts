import { DataFrameType, FieldType, toDataFrame } from '@grafana/data';
import {
  LOGS_DATAPLANE_BODY_NAME,
  LOGS_DATAPLANE_TIMESTAMP_NAME,
  type LogsFrame,
  parseLogsFrame,
} from 'app/features/logs/logsFrame';

import { buildColumnsWithMeta } from './buildColumnsWithMeta';

describe('buildColumnsWithMeta', () => {
  const testLogsDataFrame = [
    toDataFrame({
      meta: {
        type: DataFrameType.LogLines,
      },
      fields: [
        { name: LOGS_DATAPLANE_TIMESTAMP_NAME, type: FieldType.time, values: [1, 2] },
        { name: LOGS_DATAPLANE_BODY_NAME, type: FieldType.string, values: ['log 1', 'log 2'] },
        { name: 'service', type: FieldType.string, values: ['service 1', 'service 2'] },
        { name: 'backend', type: FieldType.string, values: ['backend 1', null] },
      ],
    }),
  ];
  const testLogsFrame = parseLogsFrame(testLogsDataFrame[0]) as LogsFrame;

  it('sets default fields', () => {
    const fieldNameMeta = buildColumnsWithMeta(
      {
        severityField: testLogsFrame.severityField,
        extraFields: testLogsFrame.extraFields,
        timeField: testLogsFrame.timeField,
        bodyField: testLogsFrame.bodyField,
      },
      testLogsDataFrame[0],
      []
    );

    expect(fieldNameMeta[testLogsFrame.timeField.name]).toMatchObject({
      active: true,
      index: 0,
      percentOfLinesWithLabel: 100,
    });
    expect(fieldNameMeta[testLogsFrame.bodyField.name]).toMatchObject({
      active: true,
      index: 1,
      percentOfLinesWithLabel: 100,
    });
    expect(fieldNameMeta['service']).toMatchObject({ active: false, index: undefined, percentOfLinesWithLabel: 100 });
    expect(fieldNameMeta['backend']).toMatchObject({ active: false, index: undefined, percentOfLinesWithLabel: 50 });
  });

  it('respects displayed fields', () => {
    const fieldNameMeta = buildColumnsWithMeta(
      {
        severityField: testLogsFrame.severityField,
        extraFields: testLogsFrame.extraFields,
        timeField: testLogsFrame.timeField,
        bodyField: testLogsFrame.bodyField,
      },
      testLogsDataFrame[0],
      ['backend']
    );

    expect(fieldNameMeta[testLogsFrame.timeField.name]).toMatchObject({
      active: false,
      index: undefined,
      percentOfLinesWithLabel: 100,
    });
    expect(fieldNameMeta[testLogsFrame.bodyField.name]).toMatchObject({
      active: false,
      index: undefined,
      percentOfLinesWithLabel: 100,
    });
    expect(fieldNameMeta['service']).toMatchObject({ active: false, index: undefined, percentOfLinesWithLabel: 100 });
    expect(fieldNameMeta['backend']).toMatchObject({ active: true, index: 0, percentOfLinesWithLabel: 50 });
  });

  it('keys columns by field.name when config.displayName differs (e.g. CloudWatch Logs)', () => {
    // CloudWatch sets config.displayName "Time" on the time field; previously we keyed the
    // meta store by getFieldDisplayName and then looked up by field.name — crashing on .type.
    const frameWithDisplayNames = toDataFrame({
      meta: {
        type: DataFrameType.LogLines,
      },
      fields: [
        {
          name: LOGS_DATAPLANE_TIMESTAMP_NAME,
          type: FieldType.time,
          values: [1, 2],
          config: { displayName: 'Time' },
        },
        {
          name: LOGS_DATAPLANE_BODY_NAME,
          type: FieldType.string,
          values: ['log 1', 'log 2'],
          config: { displayName: 'Line' },
        },
        { name: 'service', type: FieldType.string, values: ['svc-a', 'svc-b'] },
      ],
    });
    const logsFrame = parseLogsFrame(frameWithDisplayNames) as LogsFrame;

    const fieldNameMeta = buildColumnsWithMeta(
      {
        severityField: logsFrame.severityField,
        extraFields: logsFrame.extraFields,
        timeField: logsFrame.timeField,
        bodyField: logsFrame.bodyField,
      },
      frameWithDisplayNames,
      [LOGS_DATAPLANE_TIMESTAMP_NAME, LOGS_DATAPLANE_BODY_NAME]
    );

    expect(fieldNameMeta[LOGS_DATAPLANE_TIMESTAMP_NAME]).toMatchObject({
      active: true,
      index: 0,
      type: 'TIME_FIELD',
      percentOfLinesWithLabel: 100,
    });
    expect(fieldNameMeta[LOGS_DATAPLANE_BODY_NAME]).toMatchObject({
      active: true,
      index: 1,
      type: 'BODY_FIELD',
      percentOfLinesWithLabel: 100,
    });
    // Display names must not be used as store keys (would crash when setting .type)
    expect(fieldNameMeta['Time']).toBeUndefined();
    expect(fieldNameMeta['Line']).toBeUndefined();
  });
});
