import { of } from 'rxjs';

import { DataQueryRequest, DataSourceRef, TimeRange } from '@grafana/data';
import { BackendSrvRequest, BackendSrv, config } from '@grafana/runtime';
import { GRAFANA_DATASOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { GrafanaQueryType } from 'app/plugins/datasource/grafana/types';

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
});
