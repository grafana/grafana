import { waitFor } from '@testing-library/react';

import { config } from '@grafana/runtime';
import {
  behaviors,
  sceneGraph,
  SceneGridItem,
  SceneGridLayout,
  SceneQueryRunner,
  SceneTimeRange,
  VizPanel,
} from '@grafana/scenes';

import { DashboardControls } from './DashboardControls';
import { DashboardScene } from './DashboardScene';
import { ScopesDashboardsScene } from './ScopesDashboardsScene';
import { ScopesFiltersScene } from './ScopesFiltersScene';
import { ScopesScene } from './ScopesScene';

const dashboardsMocks = {
  dashboard1: {
    uid: 'dashboard1',
    title: 'Dashboard 1',
    url: '/d/dashboard1',
  },
  dashboard2: {
    uid: 'dashboard2',
    title: 'Dashboard 2',
    url: '/d/dashboard2',
  },
  dashboard3: {
    uid: 'dashboard3',
    title: 'Dashboard 3',
    url: '/d/dashboard3',
  },
};

const scopesMocks = {
  scope1: {
    uid: 'scope1',
    title: 'Scope 1',
    type: 'Type 1',
    description: 'Description 1',
    category: 'Category 1',
    filters: [
      { key: 'a-key', operator: '=', value: 'a-value' },
      { key: 'b-key', operator: '!=', value: 'b-value' },
    ],
    dashboards: [dashboardsMocks.dashboard1, dashboardsMocks.dashboard2, dashboardsMocks.dashboard3],
  },
  scope2: {
    uid: 'scope2',
    title: 'Scope 2',
    type: 'Type 2',
    description: 'Description 2',
    category: 'Category 2',
    filters: [{ key: 'c-key', operator: '!=', value: 'c-value' }],
    dashboards: [dashboardsMocks.dashboard3],
  },
  scope3: {
    uid: 'scope3',
    title: 'Scope 3',
    type: 'Type 1',
    description: 'Description 3',
    category: 'Category 1',
    filters: [{ key: 'd-key', operator: '=', value: 'd-value' }],
    dashboards: [dashboardsMocks.dashboard1, dashboardsMocks.dashboard2],
  },
};

jest.mock('@grafana/runtime', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    get: jest.fn().mockImplementation((url: string) => {
      if (url === '/apis/scope.grafana.app/v0alpha1/scopes') {
        return {
          items: Object.values(scopesMocks).map((scope) => ({
            metadata: { uid: scope.uid },
            spec: {
              title: scope.title,
              type: scope.type,
              description: scope.description,
              category: scope.category,
              filters: scope.filters,
            },
          })),
        };
      }

      if (url === '/apis/scope.grafana.app/v0alpha1/scopedashboards') {
        return {
          items: Object.values(scopesMocks).map((scope) => ({
            spec: {
              dashboardUids: scope.dashboards.map((dashboard) => dashboard.uid),
              scopeUid: scope.uid,
            },
          })),
        };
      }

      if (url.startsWith('/api/dashboards/uid/')) {
        const uid = url.split('/').pop();

        if (!uid) {
          return {};
        }

        const dashboard = Object.values(dashboardsMocks).find((dashboard) => dashboard.uid === uid);

        if (!dashboard) {
          return {};
        }

        return {
          dashboard: {
            title: dashboard.title,
            uid,
          },
          meta: {
            url: dashboard.url,
          },
        };
      }

      return {};
    }),
  }),
}));

describe('ScopesScene', () => {
  describe('Feature flag off', () => {
    beforeAll(() => {
      config.featureToggles.scopeFilters = false;
    });

    it('Does not initialize', () => {
      const dashboardScene = buildTestScene();
      dashboardScene.activate();
      const scopesScene = dashboardScene.state.scopes;

      expect(scopesScene).toBeUndefined();
    });
  });

  describe('Feature flag on', () => {
    let dashboardScene: DashboardScene;
    let scopesScene: ScopesScene;
    let filtersScene: ScopesFiltersScene;
    let dashboardsScene: ScopesDashboardsScene;
    let fetchScopesSpy: jest.SpyInstance;
    let fetchDashboardsSpy: jest.SpyInstance;

    beforeAll(() => {
      config.featureToggles.scopeFilters = true;
    });

    beforeEach(() => {
      dashboardScene = buildTestScene();
      scopesScene = dashboardScene.state.scopes!;
      filtersScene = scopesScene.state.filters;
      dashboardsScene = scopesScene.state.dashboards;
      fetchScopesSpy = jest.spyOn(filtersScene!, 'fetchScopes');
      fetchDashboardsSpy = jest.spyOn(dashboardsScene!, 'fetchDashboards');
      dashboardScene.activate();
      scopesScene.activate();
      filtersScene.activate();
      dashboardsScene.activate();
    });

    it('Initializes', () => {
      expect(scopesScene).toBeInstanceOf(ScopesScene);
      expect(filtersScene).toBeInstanceOf(ScopesFiltersScene);
      expect(dashboardsScene).toBeInstanceOf(ScopesDashboardsScene);
    });

    it('Fetches scopes list', async () => {
      expect(fetchScopesSpy).toHaveBeenCalled();
    });

    it('Fetches dashboards list', () => {
      filtersScene.setScope(scopesMocks.scope1.uid);

      waitFor(() => {
        expect(fetchDashboardsSpy).toHaveBeenCalled();
        expect(dashboardsScene.state.dashboards).toEqual(scopesMocks.scope1.dashboards);
      });

      filtersScene.setScope(scopesMocks.scope2.uid);

      waitFor(() => {
        expect(fetchDashboardsSpy).toHaveBeenCalled();
        expect(dashboardsScene.state.dashboards).toEqual(scopesMocks.scope2.dashboards);
      });
    });

    it('Enriches data requests', () => {
      const { dashboards: _dashboards, ...scope1 } = scopesMocks.scope1;

      filtersScene.setScope(scope1.uid);

      const queryRunner = sceneGraph.findObject(dashboardScene, (o) => o.state.key === 'data-query-runner')!;

      expect(dashboardScene.enrichDataRequest(queryRunner).scope).toEqual(scope1);
    });

    it('Toggles expanded state', async () => {
      scopesScene.toggleIsExpanded();

      expect(scopesScene.state.isExpanded).toEqual(true);
    });

    it('Enters view mode', async () => {
      dashboardScene.onEnterEditMode();

      expect(scopesScene.state.isViewing).toEqual(true);
      expect(scopesScene.state.isExpanded).toEqual(false);
    });

    it('Exits view mode', async () => {
      dashboardScene.onEnterEditMode();
      dashboardScene.exitEditMode({ skipConfirm: true });

      expect(scopesScene.state.isViewing).toEqual(false);
      expect(scopesScene.state.isExpanded).toEqual(false);
    });
  });
});

function buildTestScene(overrides: Partial<DashboardScene> = {}) {
  return new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    description: 'hello description',
    tags: ['tag1', 'tag2'],
    editable: true,
    $timeRange: new SceneTimeRange({
      timeZone: 'browser',
    }),
    controls: new DashboardControls({}),
    $behaviors: [new behaviors.CursorSync({})],
    body: new SceneGridLayout({
      children: [
        new SceneGridItem({
          key: 'griditem-1',
          x: 0,
          y: 0,
          width: 300,
          height: 300,
          body: new VizPanel({
            title: 'Panel A',
            key: 'panel-1',
            pluginId: 'table',
            $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
          }),
        }),
      ],
    }),
    ...overrides,
  });
}
