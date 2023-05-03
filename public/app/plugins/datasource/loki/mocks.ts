import {
  DataFrame,
  DataFrameType,
  DataSourceInstanceSettings,
  DataSourceSettings,
  FieldType,
  PluginType,
  toUtc,
} from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';

import { getMockDataSource } from '../../../features/datasources/__mocks__';

import { LokiDatasource } from './datasource';
import { LokiOptions } from './types';

export function createDefaultConfigOptions(): DataSourceSettings<LokiOptions> {
  return getMockDataSource<LokiOptions>({
    jsonData: { maxLines: '531' },
  });
}

const rawRange = {
  from: toUtc('2018-04-25 10:00'),
  to: toUtc('2018-04-25 11:00'),
};

const defaultTimeSrvMock = {
  timeRange: jest.fn().mockReturnValue({
    from: rawRange.from,
    to: rawRange.to,
    raw: rawRange,
  }),
};

const defaultTemplateSrvMock = {
  replace: (input: string) => input,
};

export function createLokiDatasource(
  templateSrvMock: Partial<TemplateSrv> = defaultTemplateSrvMock,
  settings: Partial<DataSourceInstanceSettings<LokiOptions>> = {},
  timeSrvStub = defaultTimeSrvMock
): LokiDatasource {
  const customSettings: DataSourceInstanceSettings<LokiOptions> = {
    url: 'myloggingurl',
    id: 0,
    uid: '',
    type: '',
    name: '',
    meta: {
      id: 'id',
      name: 'name',
      type: PluginType.datasource,
      module: '',
      baseUrl: '',
      info: {
        author: {
          name: 'Test',
        },
        description: '',
        links: [],
        logos: {
          large: '',
          small: '',
        },
        screenshots: [],
        updated: '',
        version: '',
      },
    },
    readOnly: false,
    jsonData: {
      maxLines: '20',
    },
    access: 'direct',
    ...settings,
  };

  // @ts-expect-error
  return new LokiDatasource(customSettings, templateSrvMock, timeSrvStub);
}

export function createMetadataRequest(
  labelsAndValues: Record<string, string[]>,
  series?: Record<string, Array<Record<string, string>>>
) {
  // added % to allow urlencoded labelKeys. Note, that this is not confirm with Loki, as loki does not allow specialcharacters in labelKeys, but needed for tests.
  const lokiLabelsAndValuesEndpointRegex = /^label\/([%\w]*)\/values/;
  const lokiSeriesEndpointRegex = /^series/;
  const lokiLabelsEndpoint = 'labels';
  const labels = Object.keys(labelsAndValues);

  return async function metadataRequestMock(url: string, params?: Record<string, string | number>) {
    if (url === lokiLabelsEndpoint) {
      return labels;
    } else {
      const labelsMatch = url.match(lokiLabelsAndValuesEndpointRegex);
      const seriesMatch = url.match(lokiSeriesEndpointRegex);
      if (labelsMatch) {
        return labelsAndValues[labelsMatch[1]] || [];
      } else if (seriesMatch && series && params) {
        return series[params['match[]']] || [];
      } else {
        throw new Error(`Unexpected url error, ${url}`);
      }
    }
  };
}

export function getMockFrames() {
  const logFrameA: DataFrame = {
    refId: 'A',
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [3, 4],
      },
      {
        name: 'Line',
        type: FieldType.string,
        config: {},
        values: ['line1', 'line2'],
      },
      {
        name: 'labels',
        type: FieldType.other,
        config: {},
        values: [
          {
            label: 'value',
          },
          {
            otherLabel: 'other value',
          },
        ],
      },
      {
        name: 'tsNs',
        type: FieldType.string,
        config: {},
        values: ['3000000', '4000000'],
      },
      {
        name: 'id',
        type: FieldType.string,
        config: {},
        values: ['id1', 'id2'],
      },
    ],
    meta: {
      custom: {
        frameType: 'LabeledTimeValues',
      },
      stats: [
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 11 },
        { displayName: 'Ingester: total reached', value: 1 },
      ],
    },
    length: 2,
  };

  const logFrameB: DataFrame = {
    refId: 'A',
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [1, 2],
      },
      {
        name: 'Line',
        type: FieldType.string,
        config: {},
        values: ['line3', 'line4'],
      },
      {
        name: 'labels',
        type: FieldType.other,
        config: {},
        values: [
          {
            otherLabel: 'other value',
          },
        ],
      },
      {
        name: 'tsNs',
        type: FieldType.string,
        config: {},
        values: ['1000000', '2000000'],
      },
      {
        name: 'id',
        type: FieldType.string,
        config: {},
        values: ['id3', 'id4'],
      },
    ],
    meta: {
      custom: {
        frameType: 'LabeledTimeValues',
      },
      stats: [
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 22 },
        { displayName: 'Ingester: total reached', value: 2 },
      ],
    },
    length: 2,
  };

  const metricFrameA: DataFrame = {
    refId: 'A',
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [3000000, 4000000],
      },
      {
        name: 'Value',
        type: FieldType.number,
        config: {},
        values: [5, 4],
        labels: {
          level: 'debug',
        },
      },
    ],
    meta: {
      type: DataFrameType.TimeSeriesMulti,
      stats: [
        { displayName: 'Ingester: total reached', value: 1 },
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 11 },
      ],
    },
    length: 2,
  };

  const metricFrameB: DataFrame = {
    refId: 'A',
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [1000000, 2000000],
      },
      {
        name: 'Value',
        type: FieldType.number,
        config: {},
        values: [6, 7],
        labels: {
          level: 'debug',
        },
      },
    ],
    meta: {
      type: DataFrameType.TimeSeriesMulti,
      stats: [
        { displayName: 'Ingester: total reached', value: 2 },
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 22 },
      ],
    },
    length: 2,
  };

  const metricFrameC: DataFrame = {
    refId: 'A',
    name: 'some-time-series',
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [3000000, 4000000],
      },
      {
        name: 'Value',
        type: FieldType.number,
        config: {},
        values: [6, 7],
        labels: {
          level: 'error',
        },
      },
    ],
    meta: {
      type: DataFrameType.TimeSeriesMulti,
      stats: [
        { displayName: 'Ingester: total reached', value: 2 },
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 33 },
      ],
    },
    length: 2,
  };

  return {
    logFrameA,
    logFrameB,
    metricFrameA,
    metricFrameB,
    metricFrameC,
  };
}
