import { cleanup } from '@testing-library/react';

import { config, locationService } from '@grafana/runtime';
import { getDashboardAPI, setDashboardAPI } from 'app/features/dashboard/api/dashboard_api';

import { initializeScopes } from '../instance';

import { getMock } from './utils/mocks';
import { resetScenes } from './utils/render';

jest.mock('@grafana/runtime', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    get: getMock,
  }),
}));

describe('Scopes', () => {
  describe('Dashboards API', () => {
    describe('Feature flag off', () => {
      beforeAll(() => {
        config.featureToggles.scopeFilters = true;
        config.featureToggles.passScopeToDashboardApi = false;
      });

      beforeEach(() => {
        getMock.mockClear();
        setDashboardAPI(undefined);
        locationService.push('/?scopes=scope1&scopes=scope2&scopes=scope3');
      });

      afterEach(() => {
        resetScenes();
        cleanup();
      });

      it('Legacy API should not pass the scopes', async () => {
        config.featureToggles.kubernetesDashboards = false;
        await getDashboardAPI().getDashboardDTO('1');
        expect(getMock).toHaveBeenCalledWith('/api/dashboards/uid/1', undefined);
      });

      it('K8s API should not pass the scopes', async () => {
        config.featureToggles.kubernetesDashboards = true;
        await getDashboardAPI().getDashboardDTO('1');
        expect(getMock).toHaveBeenCalledWith(
          '/apis/dashboard.grafana.app/v0alpha1/namespaces/default/dashboards/1/dto'
        );
      });
    });

    describe('Feature flag on', () => {
      beforeAll(() => {
        config.featureToggles.scopeFilters = true;
        config.featureToggles.passScopeToDashboardApi = true;
      });

      beforeEach(() => {
        setDashboardAPI(undefined);
        locationService.push('/?scopes=scope1&scopes=scope2&scopes=scope3');
        initializeScopes();
      });

      afterEach(() => {
        resetScenes();
        cleanup();
      });

      it('Legacy API should pass the scopes', async () => {
        config.featureToggles.kubernetesDashboards = false;
        await getDashboardAPI().getDashboardDTO('1');
        expect(getMock).toHaveBeenCalledWith('/api/dashboards/uid/1', { scopes: ['scope1', 'scope2', 'scope3'] });
      });

      it('K8s API should not pass the scopes', async () => {
        config.featureToggles.kubernetesDashboards = true;
        await getDashboardAPI().getDashboardDTO('1');
        expect(getMock).toHaveBeenCalledWith(
          '/apis/dashboard.grafana.app/v0alpha1/namespaces/default/dashboards/1/dto'
        );
      });
    });
  });
});
