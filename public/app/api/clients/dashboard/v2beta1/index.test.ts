import { configureStore } from '@reduxjs/toolkit';
import { http, HttpResponse } from 'msw';

import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { dashboardAPIv2beta1 } from './index';

setBackendSrv(backendSrv);
setupMockServer();

describe('dashboardAPIv2beta1 variable cache invalidation', () => {
  const createTestStore = () =>
    configureStore({
      reducer: {
        [dashboardAPIv2beta1.reducerPath]: dashboardAPIv2beta1.reducer,
      },
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(dashboardAPIv2beta1.middleware),
    });

  it('does not refetch an active getVariable subscription after deleting that variable', async () => {
    const store = createTestStore();
    const variableQueryArg = { name: 'region' };

    const getVariableSpy = jest.fn();
    const deleteVariableSpy = jest.fn();
    server.use(
      http.get('/apis/dashboard.grafana.app/v2beta1/namespaces/:namespace/variables/region', () => {
        getVariableSpy();
        return HttpResponse.json({ metadata: { name: 'region' } });
      }),
      http.delete('/apis/dashboard.grafana.app/v2beta1/namespaces/:namespace/variables/region', () => {
        deleteVariableSpy();
        return HttpResponse.json({});
      })
    );

    const subscription = store.dispatch(dashboardAPIv2beta1.endpoints.getVariable.initiate(variableQueryArg));
    await subscription;
    await store.dispatch(dashboardAPIv2beta1.endpoints.deleteVariable.initiate({ name: 'region' }));

    expect(getVariableSpy).toHaveBeenCalledTimes(1);
    expect(deleteVariableSpy).toHaveBeenCalledTimes(1);

    subscription.unsubscribe();
  });
});
