import { of } from 'rxjs';

import { DataQueryRequest, DataSourceRef, dateTime, TimeRange } from '@grafana/data';
import { BackendSrvRequest, BackendSrv, config } from '@grafana/runtime';
import { GrafanaQueryType } from 'app/plugins/datasource/grafana/types';

import { GRAFANA_DATASOURCE_NAME } from '../../alerting/unified/utils/datasource';

import { PublicAnnotationsDataSource } from './PublicAnnotationsDataSource';

const mockDatasourceRequest = jest.fn();

const backendSrv = {
  fetch: (options: BackendSrvRequest) => {
    return of(mockDatasourceRequest(options));
  },
  get: (url: string, options?: Partial<BackendSrvRequest>) => {
    return mockDatasourceRequest(url, options);
  },
} as unknown as BackendSrv;

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
  getDataSourceSrv: () => {
    return {
      getInstanceSettings: (ref?: DataSourceRef) => ({ type: ref?.type ?? '?', uid: ref?.uid ?? '?' }),
    };
  },
}));

describe('PublicDashboardDatasource', () => {
  test('will add annotation query type to annotations', () => {
    const ds = new PublicAnnotationsDataSource();
    const annotationQuery = {
      enable: true,
      name: 'someName',
      iconColor: 'red',
    };

    // @ts-ignore
    const annotation = ds?.annotations.prepareQuery(annotationQuery);

    expect(annotation?.queryType).toEqual(GrafanaQueryType.Annotations);
  });

  test('fetches results from the pubdash annotations endpoint when it is an annotation query', async () => {
    mockDatasourceRequest.mockReset();
    mockDatasourceRequest.mockReturnValue(Promise.resolve([]));

    const ds = new PublicAnnotationsDataSource();
    const panelId = 1;

    config.publicDashboardAccessToken = 'abc123';

    await ds.query({
      maxDataPoints: 10,
      intervalMs: 5000,
      targets: [
        {
          refId: 'A',
          datasource: { uid: GRAFANA_DATASOURCE_NAME, type: 'sample' },
          queryType: GrafanaQueryType.Annotations,
        },
      ],
      panelId,
      range: { from: new Date().toLocaleString(), to: new Date().toLocaleString() } as unknown as TimeRange,
    } as DataQueryRequest);

    const mock = mockDatasourceRequest.mock;

    expect(mock.calls.length).toBe(1);
    expect(mock.lastCall[0]).toEqual(`/api/public/dashboards/abc123/annotations`);
  });

  test('fetches results from the pubdash query endpoint when not annotation query', () => {
    mockDatasourceRequest.mockReset();
    mockDatasourceRequest.mockReturnValue(Promise.resolve({}));

    const ds = new PublicAnnotationsDataSource();
    const panelId = 1;
    config.publicDashboardAccessToken = 'abc123';

    ds.query({
      maxDataPoints: 10,
      intervalMs: 5000,
      targets: [{ refId: 'A' }, { refId: 'B', datasource: { type: 'sample' } }],
      panelId,
      range: {
        from: dateTime('2022-01-01T15:55:00Z'),
        to: dateTime('2022-07-12T15:55:00Z'),
        raw: {
          from: 'now-15m',
          to: 'now',
        },
      },
    } as DataQueryRequest);

    const mock = mockDatasourceRequest.mock;

    expect(mock.calls.length).toBe(1);
    expect(mock.lastCall[0].url).toEqual(`/api/public/dashboards/abc123/panels/${panelId}/query`);
  });
});
