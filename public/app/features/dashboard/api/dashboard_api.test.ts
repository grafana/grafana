import { config } from '@grafana/runtime';

import { getDashboardAPI, setDashboardAPI } from './dashboard_api';
import { LegacyDashboardAPI } from './legacy';
import { K8sDashboardAPI } from './v0';
import { K8sDashboardV2API } from './v2';

describe('DashboardApi', () => {
  it('should use legacy api by default', () => {
    expect(getDashboardAPI()).toBeInstanceOf(LegacyDashboardAPI);
  });

  it('should allow overriding clients in test environment', () => {
    process.env.NODE_ENV = 'test';
    const mockClient = { legacy: new LegacyDashboardAPI() };
    setDashboardAPI(mockClient);
    const api = getDashboardAPI();
    expect(api).toBe(mockClient.legacy);
    setDashboardAPI(undefined);
  });

  describe('when scenes enabled', () => {
    beforeEach(() => {
      config.featureToggles.dashboardScene = true;
    });

    it('should use legacy api kubernetesDashboards toggle is disabled', () => {
      config.featureToggles.kubernetesDashboards = false;
      expect(getDashboardAPI()).toBeInstanceOf(LegacyDashboardAPI);
    });

    it('should use v0 api when and kubernetesDashboards toggle is enabled', () => {
      config.featureToggles.kubernetesDashboards = true;
      expect(getDashboardAPI()).toBeInstanceOf(K8sDashboardAPI);
    });

    it('should use v2 api when and useV2DashboardsAPI toggle is enabled', () => {
      config.featureToggles.useV2DashboardsAPI = true;
      expect(getDashboardAPI()).toBeInstanceOf(K8sDashboardV2API);
    });
  });

  describe('when scenes disabled', () => {
    beforeEach(() => {
      config.featureToggles.dashboardScene = false;
    });

    it('should use legacy api when kubernetesDashboards toggle is disabled', () => {
      config.featureToggles.kubernetesDashboards = undefined;
      expect(getDashboardAPI()).toBeInstanceOf(LegacyDashboardAPI);
    });

    it('should use legacy api when kubernetesDashboards toggle is disabled', () => {
      config.featureToggles.kubernetesDashboards = false;
      expect(getDashboardAPI()).toBeInstanceOf(LegacyDashboardAPI);
    });

    it('should use v0 api when kubernetesDashboards toggle is enabled', () => {
      config.featureToggles.kubernetesDashboards = true;
      expect(getDashboardAPI()).toBeInstanceOf(K8sDashboardAPI);
    });

    it('should use v0 api when kubernetesDashboards and useV2DashboardsAPI toggle is enabled', () => {
      config.featureToggles.useV2DashboardsAPI = true;
      config.featureToggles.kubernetesDashboards = true;
      expect(getDashboardAPI()).toBeInstanceOf(K8sDashboardAPI);
    });

    it('should use legacy useV2DashboardsAPI toggle is enabled', () => {
      config.featureToggles.useV2DashboardsAPI = true;
      config.featureToggles.kubernetesDashboards = undefined;
      expect(getDashboardAPI()).toBeInstanceOf(LegacyDashboardAPI);
    });
  });
});
