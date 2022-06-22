import { of } from 'rxjs';
import { BackendSrv, BackendSrvRequest } from 'src/services';

import { DataQueryRequest, DataSourceRef } from '@grafana/data';

import { PublicDashboardDataSource } from '../../../../public/app/features/dashboard/services/PublicDashboardDataSource';

const mockDatasourceRequest = jest.fn();

const backendSrv = {
  fetch: (options: BackendSrvRequest) => {
    return of(mockDatasourceRequest(options));
  },
} as unknown as BackendSrv;

jest.mock('../services', () => ({
  ...jest.requireActual('../services'),
  getBackendSrv: () => backendSrv,
  getDataSourceSrv: () => {
    return {
      getInstanceSettings: (ref?: DataSourceRef) => ({ type: ref?.type ?? '?', uid: ref?.uid ?? '?' }),
    };
  },
}));

describe('PublicDashboardDatasource', () => {
  test('Fetches results from the pubdash query endpoint', () => {
    mockDatasourceRequest.mockReset();
    mockDatasourceRequest.mockReturnValue(Promise.resolve({}));

    const ds = new PublicDashboardDataSource();
    const panelId = 1;
    const publicDashboardUid = 'abc123';

    ds.query({
      maxDataPoints: 10,
      intervalMs: 5000,
      targets: [{ refId: 'A' }, { refId: 'B', datasource: { type: 'sample' } }],
      panelId,
      publicDashboardUid,
    } as DataQueryRequest);

    const mock = mockDatasourceRequest.mock;

    expect(mock.calls.length).toBe(1);
    expect(mock.lastCall[0].url).toEqual(`/api/public/dashboards/${publicDashboardUid}/panels/${panelId}/query`);
  });
});
