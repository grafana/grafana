import { config } from '@grafana/runtime';

import { getDashboardAPI, setDashboardAPI } from './dashboard_api';
import { LegacyDashboardAPI } from './legacy';
import { K8sDashboardAPI } from './v1';
import { K8sDashboardV2API } from './v2';
import { UnifiedDashboardAPI } from './UnifiedDashboardAPI';

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

    it('should use unified api when and kubernetesDashboards toggle is enabled', () => {
      config.featureToggles.kubernetesDashboards = true;
      expect(getDashboardAPI()).toBeInstanceOf(UnifiedDashboardAPI);
    });

    it('should return v1 if it is passed in the params', () => {
      expect(getDashboardAPI('v1')).toBeInstanceOf(K8sDashboardAPI);
    });

    it('should return v2 if it is passed in the params', () => {
      expect(getDashboardAPI('v2')).toBeInstanceOf(K8sDashboardV2API);
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

    it('should use v1 api when kubernetesDashboards toggle is enabled', () => {
      config.featureToggles.kubernetesDashboards = true;
      expect(getDashboardAPI()).toBeInstanceOf(UnifiedDashboardAPI);
    });

    it('should use v1 when v1 is passed in the params', () => {
      expect(getDashboardAPI('v1')).toBeInstanceOf(K8sDashboardAPI);
    });

    it('should use v2 when v2 is passed in the params', () => {
      expect(getDashboardAPI('v2')).toBeInstanceOf(K8sDashboardV2API);
    });
  });
});
