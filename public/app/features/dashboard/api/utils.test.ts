import { config, locationService } from '@grafana/runtime';

import { getDashboardsApiVersion } from './utils';

describe('getDashboardsApiVersion', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('should return v1 when dashboardScene is disabled and kubernetesDashboards is enabled', () => {
    config.featureToggles = {
      dashboardScene: false,
      kubernetesDashboards: true,
    };
    expect(getDashboardsApiVersion()).toBe('v1');
  });

  it('should return legacy when dashboardScene is disabled and kubernetesDashboards is disabled', () => {
    config.featureToggles = {
      dashboardScene: false,
      kubernetesDashboards: false,
    };
    expect(getDashboardsApiVersion()).toBe('legacy');
  });

  it('should return unified when dashboardScene is enabled and kubernetesDashboards is enabled', () => {
    config.featureToggles = {
      dashboardScene: true,
      kubernetesDashboards: true,
    };
    expect(getDashboardsApiVersion()).toBe('unified');
  });

  it('should return legacy when dashboardScene is enabled and kubernetesDashboards is disabled', () => {
    config.featureToggles = {
      dashboardScene: true,
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
        kubernetesDashboards: false,
      };
      expect(getDashboardsApiVersion()).toBe('legacy');
    });

    it('should return v1 when kubernetesDashboards is enabled', () => {
      config.featureToggles = {
        dashboardScene: false,
        kubernetesDashboards: true,
      };
      expect(getDashboardsApiVersion()).toBe('v1');
    });
  });
});
