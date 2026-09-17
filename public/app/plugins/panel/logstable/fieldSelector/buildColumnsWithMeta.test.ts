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

  it('supports fields with a configured displayName', () => {
    const dataFrameWithDisplayNames = toDataFrame({
      meta: {
        type: DataFrameType.LogLines,
      },
      fields: [
        {
          name: LOGS_DATAPLANE_TIMESTAMP_NAME,
          type: FieldType.time,
          values: [1, 2],
          config: { displayName: 'Time (display)' },
        },
        {
          name: LOGS_DATAPLANE_BODY_NAME,
          type: FieldType.string,
          values: ['log 1', 'log 2'],
          config: { displayName: 'Body (display)' },
        },
        { name: 'service', type: FieldType.string, values: ['service 1', 'service 2'], config: { displayName: 'Svc' } },
        { name: 'backend', type: FieldType.string, values: ['backend 1', null], config: { displayName: 'BE' } },
      ],
    });
    const logsFrameWithDisplayNames = parseLogsFrame(dataFrameWithDisplayNames) as LogsFrame;

    let fieldNameMeta;
    expect(() => {
      fieldNameMeta = buildColumnsWithMeta(
        {
          severityField: logsFrameWithDisplayNames.severityField,
          extraFields: logsFrameWithDisplayNames.extraFields,
          timeField: logsFrameWithDisplayNames.timeField,
          bodyField: logsFrameWithDisplayNames.bodyField,
        },
        dataFrameWithDisplayNames,
        ['service']
      );
    }).not.toThrow();

    // Keys must be the field name, never the display name
    expect(fieldNameMeta).toHaveProperty(logsFrameWithDisplayNames.timeField.name);
    expect(fieldNameMeta).toHaveProperty(logsFrameWithDisplayNames.bodyField.name);
    expect(fieldNameMeta).toHaveProperty('service');
    expect(fieldNameMeta).toHaveProperty('backend');
    expect(fieldNameMeta).not.toHaveProperty('Time (display)');
    expect(fieldNameMeta).not.toHaveProperty('Body (display)');
    expect(fieldNameMeta).not.toHaveProperty('Svc');
    expect(fieldNameMeta!['service']).toMatchObject({ active: true, index: 0 });
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
});
