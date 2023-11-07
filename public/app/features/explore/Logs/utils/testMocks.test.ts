import { DataFrame, Field, FieldType } from '@grafana/data/src';

import { DataFrameType } from '../../../../../../packages/grafana-data';

export const getMockLokiFrame = (override?: Partial<DataFrame>) => {
  const testDataFrame: DataFrame = {
    meta: {
      custom: {
        frameType: 'LabeledTimeValues',
      },
    },
    fields: [
      {
        config: {},
        name: 'labels',
        type: FieldType.other,
        typeInfo: {
          frame: 'json.RawMessage',
        },
        values: [
          { app: 'grafana', cluster: 'dev-us-central-0', container: 'hg-plugins' },
          { app: 'grafana', cluster: 'dev-us-central-1', container: 'hg-plugins' },
          { app: 'grafana', cluster: 'dev-us-central-2', container: 'hg-plugins' },
        ],
      } as Field,
      {
        config: {},
        name: 'Time',
        type: FieldType.time,
        values: ['2019-01-01 10:00:00', '2019-01-01 11:00:00', '2019-01-01 12:00:00'],
      },
      {
        config: {},
        name: 'Line',
        type: FieldType.string,
        values: ['log message 1', 'log message 2', 'log message 3'],
      },
      {
        config: {},
        name: 'tsNs',
        type: FieldType.string,
        values: ['1697561006608165746', '1697560998869868000', '1697561010006578474'],
      },
      {
        config: {},
        name: 'id',
        type: FieldType.string,
        values: ['1697561006608165746_b4cc4b72', '1697560998869868000_eeb96c0f', '1697561010006578474_ad5e2e5a'],
      },
    ],
    length: 3,
  };
  return { ...testDataFrame, ...override };
};
export const getMockLokiFrameDataPlane = (override?: Partial<DataFrame>): DataFrame => {
  const testDataFrame: DataFrame = {
    meta: {
      type: DataFrameType.LogLines,
    },
    fields: [
      {
        config: {},
        name: 'labels',
        type: FieldType.other,
        values: [
          { app: 'grafana', cluster: 'dev-us-central-0', container: 'hg-plugins' },
          { app: 'grafana', cluster: 'dev-us-central-1', container: 'hg-plugins' },
          { app: 'grafana', cluster: 'dev-us-central-2', container: 'hg-plugins' },
        ],
      },
      {
        config: {},
        name: 'timestamp',
        type: FieldType.time,
        values: ['2019-01-01 10:00:00', '2019-01-01 11:00:00', '2019-01-01 12:00:00'],
      },
      {
        config: {},
        name: 'body',
        type: FieldType.string,
        values: ['log message 1', 'log message 2', 'log message 3'],
      },
      {
        config: {},
        name: 'tsNs',
        type: FieldType.string,
        values: ['1697561006608165746', '1697560998869868000', '1697561010006578474'],
      },
      {
        config: {},
        name: 'id',
        type: FieldType.string,
        values: ['1697561006608165746_b4cc4b72', '1697560998869868000_eeb96c0f', '1697561010006578474_ad5e2e5a'],
      },
      {
        config: {
          links: [
            {
              url: 'http://example.com',
              title: 'foo',
            },
          ],
        },
        name: 'traceID',
        type: FieldType.string,
        values: ['trace1', 'trace2', 'trace3'],
      },
    ],
    length: 3,
  };
  return { ...testDataFrame, ...override };
};

export const getMockElasticFrame = (override?: Partial<DataFrame>, timestamp = 1697732037084) => {
  const testDataFrame: DataFrame = {
    meta: {},
    fields: [
      {
        name: '@timestamp',
        type: FieldType.time,
        values: [timestamp, timestamp + 1000, timestamp + 2000],
        config: {},
      },
      {
        name: 'line',
        type: FieldType.string,
        values: ['log message 1', 'log message 2', 'log message 3'],
        config: {},
      },
      {
        name: 'counter',
        type: FieldType.string,
        values: ['1', '2', '3'],
        config: {},
      },
      {
        name: 'level',
        type: FieldType.string,
        values: ['info', 'info', 'info'],
        config: {},
      },
      {
        name: 'id',
        type: FieldType.string,
        values: ['1', '2', '3'],
        config: {},
      },
    ],
    length: 3,
  };
  return { ...testDataFrame, ...override };
};

it('should return a frame', () => {
  expect(
    getMockLokiFrame({
      name: 'test',
    })
  ).toMatchObject({
    name: 'test',
  });
});
