import { config, locationService } from '@grafana/runtime';

import { getDashboardsApiVersion } from './utils';

describe('getDashboardsApiVersion', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('should return v0 when dashboardScene is disabled and kubernetesDashboards is enabled', () => {
    config.featureToggles = {
      dashboardScene: false,
      kubernetesDashboards: true,
    };
    expect(getDashboardsApiVersion()).toBe('v0');
  });

  it('should return legacy when dashboardScene is disabled and kubernetesDashboards is disabled', () => {
    config.featureToggles = {
      dashboardScene: false,
      kubernetesDashboards: false,
    };
    expect(getDashboardsApiVersion()).toBe('legacy');
  });

  it('should return v2 when dashboardScene is enabled and useV2DashboardsAPI is enabled', () => {
    config.featureToggles = {
      dashboardScene: true,
      useV2DashboardsAPI: true,
    };
    expect(getDashboardsApiVersion()).toBe('v2');
  });

  it('should return v0 when dashboardScene is enabled, useV2DashboardsAPI is disabled, and kubernetesDashboards is enabled', () => {
    config.featureToggles = {
      dashboardScene: true,
      useV2DashboardsAPI: false,
      kubernetesDashboards: true,
    };
    expect(getDashboardsApiVersion()).toBe('v0');
  });

  it('should return legacy when dashboardScene is enabled and both useV2DashboardsAPI and kubernetesDashboards are disabled', () => {
    config.featureToggles = {
      dashboardScene: true,
      useV2DashboardsAPI: false,
      kubernetesDashboards: false,
    };
    expect(getDashboardsApiVersion()).toBe('legacy');
  });

  describe('forcing scenes through URL', () => {
    beforeAll(() => {
      locationService.push('/test?scenes=false');
    });

    it('should return legacy when kubernetesDashboards is disabled', () => {
      config.featureToggles = {
        dashboardScene: false,
        useV2DashboardsAPI: false,
        kubernetesDashboards: false,
      };

      expect(getDashboardsApiVersion()).toBe('legacy');
    });

    it('should return legacy when kubernetesDashboards is disabled', () => {
      config.featureToggles = {
        dashboardScene: false,
        useV2DashboardsAPI: false,
        kubernetesDashboards: true,
      };

      expect(getDashboardsApiVersion()).toBe('v0');
    });
  });
});
