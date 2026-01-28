import { config, locationService } from '@grafana/runtime';

import { getDashboardsApiVersion } from './utils';

describe('getDashboardsApiVersion', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it.each([
    {
      dashboardScene: false,
      kubernetesDashboards: true,
      expected: 'v1',
      description: 'v1 when dashboardScene is disabled and kubernetesDashboards is enabled',
    },
    {
      dashboardScene: false,
      kubernetesDashboards: false,
      expected: 'legacy',
      description: 'legacy when dashboardScene is disabled and kubernetesDashboards is disabled',
    },
    {
      dashboardScene: true,
      kubernetesDashboards: true,
      expected: 'unified',
      description: 'unified when dashboardScene is enabled and kubernetesDashboards is enabled',
    },
    {
      dashboardScene: true,
      kubernetesDashboards: false,
      expected: 'legacy',
      description: 'legacy when dashboardScene is enabled and kubernetesDashboards is disabled',
    },
  ])('should return $expected - $description', ({ dashboardScene, kubernetesDashboards, expected }) => {
    config.featureToggles = {
      dashboardScene,
      kubernetesDashboards,
    };
    expect(getDashboardsApiVersion()).toBe(expected);
  });

  describe('forcing scenes through URL', () => {
    beforeAll(() => {
      locationService.push('/test?scenes=false');
    });

    it.each([
      {
        kubernetesDashboards: false,
        expected: 'legacy',
        description: 'legacy when kubernetesDashboards is disabled',
      },
      {
        kubernetesDashboards: true,
        expected: 'v1',
        description: 'v1 when kubernetesDashboards is enabled',
      },
    ])('should return $expected - $description', ({ kubernetesDashboards, expected }) => {
      config.featureToggles = {
        dashboardScene: false,
        kubernetesDashboards,
      };
      expect(getDashboardsApiVersion()).toBe(expected);
    });
  });

  describe('dashboardNewLayouts requires dashboardScene', () => {
    it.each([
      {
        dashboardScene: false,
        dashboardNewLayouts: true,
        expected: 'v1',
        description: 'v1 when dashboardNewLayouts is enabled but dashboardScene is disabled',
      },
      {
        dashboardScene: true,
        dashboardNewLayouts: true,
        expected: 'v2',
        description: 'v2 when both dashboardScene and dashboardNewLayouts are enabled',
      },
      {
        dashboardScene: true,
        dashboardNewLayouts: false,
        expected: 'unified',
        description: 'unified when dashboardScene is enabled but dashboardNewLayouts is disabled',
      },
    ])('should return $expected - $description', ({ dashboardScene, dashboardNewLayouts, expected }) => {
      config.featureToggles = {
        dashboardScene,
        dashboardNewLayouts,
        kubernetesDashboards: true,
      };
      expect(getDashboardsApiVersion()).toBe(expected);
    });
  });
});
