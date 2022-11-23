import { of } from 'rxjs';

import { DataQueryRequest, DataSourceInstanceSettings, DataSourceRef, TimeRange } from '@grafana/data';
import { BackendSrvRequest, BackendSrv, DataSourceWithBackend } from '@grafana/runtime';
import { GrafanaQueryType } from 'app/plugins/datasource/grafana/types';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { GRAFANA_DATASOURCE_NAME } from '../../alerting/unified/utils/datasource';

import { PublicDashboardDataSource, PUBLIC_DATASOURCE, DEFAULT_INTERVAL } from './PublicDashboardDataSource';

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
    const ds = new PublicDashboardDataSource('public');
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

    const ds = new PublicDashboardDataSource('public');
    const panelId = 1;
    const publicDashboardAccessToken = 'abc123';

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
      publicDashboardAccessToken,
      range: { from: new Date().toLocaleString(), to: new Date().toLocaleString() } as unknown as TimeRange,
    } as DataQueryRequest);

    const mock = mockDatasourceRequest.mock;

    expect(mock.calls.length).toBe(1);
    expect(mock.lastCall[0]).toEqual(`/api/public/dashboards/${publicDashboardAccessToken}/annotations`);
  });

  test('fetches results from the pubdash query endpoint when not annotation query', () => {
    mockDatasourceRequest.mockReset();
    mockDatasourceRequest.mockReturnValue(Promise.resolve({}));

    const ds = new PublicDashboardDataSource('public');
    const panelId = 1;
    const publicDashboardAccessToken = 'abc123';

    ds.query({
      maxDataPoints: 10,
      intervalMs: 5000,
      targets: [{ refId: 'A' }, { refId: 'B', datasource: { type: 'sample' } }],
      panelId,
      publicDashboardAccessToken,
    } as DataQueryRequest);

    const mock = mockDatasourceRequest.mock;

    expect(mock.calls.length).toBe(1);
    expect(mock.lastCall[0].url).toEqual(
      `/api/public/dashboards/${publicDashboardAccessToken}/panels/${panelId}/query`
    );
  });

  test('returns public datasource uid when datasource passed in is null', () => {
    let ds = new PublicDashboardDataSource(null);
    expect(ds.uid).toBe(PUBLIC_DATASOURCE);
  });

  test('returns datasource when datasource passed in is a string', () => {
    let ds = new PublicDashboardDataSource('theDatasourceUid');
    expect(ds.uid).toBe('theDatasourceUid');
  });

  test('returns datasource uid when datasource passed in is a DataSourceRef implementation', () => {
    const datasource = { type: 'datasource', uid: 'abc123' };
    let ds = new PublicDashboardDataSource(datasource);
    expect(ds.uid).toBe('abc123');
  });

  test('returns datasource uid when datasource passed in is a DatasourceApi instance', () => {
    const settings: DataSourceInstanceSettings = { id: 1, uid: 'abc123' } as DataSourceInstanceSettings;
    const datasource = new DataSourceWithBackend(settings);
    let ds = new PublicDashboardDataSource(datasource);
    expect(ds.uid).toBe('abc123');
  });

  test('isMixedDatasource returns true when datasource is mixed', () => {
    const datasource = new DataSourceWithBackend({ id: 1, uid: MIXED_DATASOURCE_NAME } as DataSourceInstanceSettings);
    let ds = new PublicDashboardDataSource(datasource);
    expect(ds.meta.mixed).toBeTruthy();
  });

  test('isMixedDatasource returns false when datasource is not mixed', () => {
    const datasource = new DataSourceWithBackend({ id: 1, uid: 'abc123' } as DataSourceInstanceSettings);
    let ds = new PublicDashboardDataSource(datasource);
    expect(ds.meta.mixed).toBeFalsy();
  });

  test('isMixedDatasource returns false when datasource is a string', () => {
    let ds = new PublicDashboardDataSource('abc123');
    expect(ds.meta.mixed).toBeFalsy();
  });

  test('isMixedDatasource returns false when datasource is null', () => {
    let ds = new PublicDashboardDataSource(null);
    expect(ds.meta.mixed).toBeFalsy();
  });

  test('returns default datasource interval when datasource passed in is null', () => {
    let ds = new PublicDashboardDataSource(null);
    expect(ds.interval).toBe(DEFAULT_INTERVAL);
  });

  test('returns default datasource interval when datasource passed in is a string', () => {
    let ds = new PublicDashboardDataSource('theDatasourceUid');
    expect(ds.interval).toBe(DEFAULT_INTERVAL);
  });

  test('returns default datasource interval when datasource passed in is a DataSourceRef implementation', () => {
    const datasource = { type: 'datasource', uid: 'abc123' };
    let ds = new PublicDashboardDataSource(datasource);
    expect(ds.interval).toBe(DEFAULT_INTERVAL);
  });

  test('returns default datasource interval when datasource passed in is a DatasourceApi instance that has no interval', () => {
    const settings: DataSourceInstanceSettings = { id: 1, uid: 'abc123' } as DataSourceInstanceSettings;
    const datasource = new DataSourceWithBackend(settings);
    let ds = new PublicDashboardDataSource(datasource);
    expect(ds.interval).toBe(DEFAULT_INTERVAL);
  });

  test('returns datasource interval when datasource passed in is a DatasourceApi instance that has interval', () => {
    const settings: DataSourceInstanceSettings = { id: 1, uid: 'abc123' } as DataSourceInstanceSettings;
    const datasource = new DataSourceWithBackend(settings);
    datasource.interval = 'abc123';
    let ds = new PublicDashboardDataSource(datasource);
    expect(ds.interval).toBe('abc123');
  });
});
