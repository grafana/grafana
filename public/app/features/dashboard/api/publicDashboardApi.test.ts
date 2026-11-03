import { HttpResponse, http } from 'msw';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { configureStore } from 'app/store/configureStore';

import { publicDashboardApi } from './publicDashboardApi';

setBackendSrv(backendSrv);
const server = setupMockServer();

describe('getPublicDashboard', () => {
  it('does not show an error notification when the request fails', async () => {
    server.use(
      http.get('/api/dashboards/uid/dash-1/public-dashboards', () =>
        HttpResponse.json({ message: 'Server error' }, { status: 500 })
      )
    );
    const store = configureStore();

    const result = await store.dispatch(publicDashboardApi.endpoints.getPublicDashboard.initiate('dash-1'));

    expect(result.isError).toBe(true);
    expect(Object.values(store.getState().appNotifications.byId)).toEqual([]);
  });
});
