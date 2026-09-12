import { configureStore } from '@reduxjs/toolkit';
import { http, HttpResponse } from 'msw';
import { type Store } from 'redux';
import { waitFor } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { dashboardAPIv2beta1 } from 'app/api/clients/dashboard/v2beta1';
import { backendSrv } from 'app/core/services/backend_srv';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import * as predefinedVariables from 'app/features/dashboard-scene/utils/predefinedVariables';
import { setStore } from 'app/store/store';

import { invalidateVariablesAfterFolderDelete } from './cache';

setBackendSrv(backendSrv);
setupMockServer();

describe('invalidateVariablesAfterFolderDelete', () => {
  it('refetches the Variable LIST cache without clearing dashboard scenes', async () => {
    const store = configureStore({
      reducer: {
        [dashboardAPIv2beta1.reducerPath]: dashboardAPIv2beta1.reducer,
      },
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(dashboardAPIv2beta1.middleware),
    });
    setStore(store as unknown as Store);

    const listSpy = jest.fn();
    const clearSceneCache = jest.spyOn(getDashboardScenePageStateManager(), 'clearSceneCache');
    const clearPredefinedVariablesCache = jest.spyOn(predefinedVariables, 'clearPredefinedVariablesCache');

    try {
      server.use(
        http.get('/apis/dashboard.grafana.app/v2beta1/namespaces/:namespace/variables', () => {
          listSpy();
          return HttpResponse.json({ items: [{ metadata: { name: 'region' } }] });
        })
      );

      const subscription = store.dispatch(dashboardAPIv2beta1.endpoints.listVariable.initiate({}));
      await subscription;
      expect(listSpy).toHaveBeenCalledTimes(1);

      invalidateVariablesAfterFolderDelete();

      await waitFor(() => {
        expect(listSpy).toHaveBeenCalledTimes(2);
      });
      expect(clearSceneCache).not.toHaveBeenCalled();
      expect(clearPredefinedVariablesCache).not.toHaveBeenCalled();

      subscription.unsubscribe();
    } finally {
      clearSceneCache.mockRestore();
      clearPredefinedVariablesCache.mockRestore();
    }
  });
});
