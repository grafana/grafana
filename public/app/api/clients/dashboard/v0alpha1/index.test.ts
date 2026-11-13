import { configureStore } from '@reduxjs/toolkit';
import { http, HttpResponse } from 'msw';

import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { dashboardAPIv0alpha1 } from './index';

setBackendSrv(backendSrv);
setupMockServer();

describe('dashboardAPIv0alpha1 searchDashboardsAndFolders', () => {
  it('sends the include param along with the generated ones', async () => {
    const store = configureStore({
      reducer: { [dashboardAPIv0alpha1.reducerPath]: dashboardAPIv0alpha1.reducer },
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(dashboardAPIv0alpha1.middleware),
    });
    let searchParams: URLSearchParams | undefined;
    server.use(
      http.get('/apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/search', ({ request }) => {
        searchParams = new URL(request.url).searchParams;
        return HttpResponse.json({ totalHits: 0, hits: [] });
      })
    );

    await store.dispatch(
      dashboardAPIv0alpha1.endpoints.searchDashboardsAndFolders.initiate({
        type: 'folder',
        folder: 'parent',
        include: 'pathToCreatable',
      })
    );

    expect(Object.fromEntries(searchParams ?? [])).toEqual({
      type: 'folder',
      folder: 'parent',
      include: 'pathToCreatable',
    });
  });
});
