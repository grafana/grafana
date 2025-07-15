import { merge } from 'lodash';

import {
  CoreApp,
  DataQueryRequest,
  DataSourceJsonData,
  DataSourceSettings,
  dateTime,
  rangeUtil,
  TimeRange,
} from '@grafana/data';

import { PromOptions, PromQuery } from '../../types';

const getMockDataSource = <T extends DataSourceJsonData>(
  overrides?: Partial<DataSourceSettings<T>>
): DataSourceSettings<T> =>
  merge(
    {
      access: '',
      basicAuth: false,
      basicAuthUser: '',
      withCredentials: false,
      database: '',
      id: 13,
      uid: 'x',
      isDefault: false,
      jsonData: { authType: 'credentials', defaultRegion: 'eu-west-2' },
      name: 'gdev-prometheus',
      typeName: 'Prometheus',
      orgId: 1,
      readOnly: false,
      type: 'prometheus',
      typeLogoUrl: 'packages/grafana-prometheus/src/img/prometheus_logo.svg',
      url: '',
      user: '',
      secureJsonFields: {},
    },
    overrides
  );

export function createDefaultConfigOptions(): DataSourceSettings<PromOptions> {
  return getMockDataSource<PromOptions>({
    jsonData: {
      timeInterval: '1m',
      queryTimeout: '1m',
      httpMethod: 'GET',
    },
  });
}

export function createDataRequest(
  targets: PromQuery[],
  overrides?: Partial<DataQueryRequest>
): DataQueryRequest<PromQuery> {
  const defaults: DataQueryRequest<PromQuery> = {
    intervalMs: 15000,
    requestId: 'createDataRequest',
    startTime: 0,
    timezone: 'browser',
    app: CoreApp.Dashboard,
    targets: targets.map((t, i) => ({
      instant: false,
      start: dateTime().subtract(5, 'minutes'),
      end: dateTime(),
      ...t,
    })),
    range: {
      from: dateTime(),
      to: dateTime(),
      raw: {
        from: '',
        to: '',
      },
    },
    interval: '15s',
    scopedVars: {},
  };

  return Object.assign(defaults, overrides || {}) as DataQueryRequest<PromQuery>;
}

export function createDefaultPromResponse() {
  return {
    data: {
      data: {
        result: [
          {
            metric: {
              __name__: 'test_metric',
            },
            values: [[1568369640, 1]],
          },
        ],
        resultType: 'matrix',
      },
    },
  };
}

export function getMockTimeRange(range = '6h'): TimeRange {
  return rangeUtil.convertRawToRange({
    from: `now-${range}`,
    to: 'now',
  });
}

export function fetchMockCalledWith(fetchMock: ReturnType<typeof jest.fn>): PromQuery[] {
  return fetchMock.mock.calls[0][0].data.queries ?? [];
}
