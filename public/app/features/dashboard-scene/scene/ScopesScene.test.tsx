import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

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

import { TestProvider } from '../../../../test/helpers/TestProvider';

import { DashboardControls } from './DashboardControls';
import { DashboardScene } from './DashboardScene';
import { ScopesDashboardsScene } from './ScopesDashboardsScene';
import { ScopesFiltersScene } from './ScopesFiltersScene';
import { ScopesScene } from './ScopesScene';

jest.mock('@grafana/runtime', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    get: jest.fn().mockImplementation((url: string) => {
      if (url === '/apis/scope.grafana.app/v0alpha1/scopes') {
        return { items: Object.values(mocks) };
      }

      return {};
    }),
  }),
}));

const mocks = {
  scope1: {
    metadata: { uid: 'scope-1' },
    spec: {
      title: 'Scope 1',
      type: 'Type 1',
      description: 'Description 1',
      category: 'Category 1',
      filters: [
        { key: 'a-key', operator: '=', value: 'a-value' },
        { key: 'b-key', operator: '!=', value: 'b-value' },
      ],
    },
  },
  scope2: {
    metadata: { uid: 'scope-2' },
    spec: {
      title: 'Scope 2',
      type: 'Type 2',
      description: 'Description 2',
      category: 'Category 2',
      filters: [{ key: 'c-key', operator: '!=', value: 'c-value' }],
    },
  },
  scope3: {
    metadata: { uid: 'scope-3' },
    spec: {
      title: 'Scope 3',
      type: 'Type 1',
      description: 'Description 3',
      category: 'Category 1',
      filters: [{ key: 'd-key', operator: '=', value: 'd-value' }],
    },
  },
};

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

      render(
        <TestProvider>
          <dashboardScene.Component model={dashboardScene} />
        </TestProvider>
      );
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
      filtersScene.setScope(mocks.scope1.metadata.uid);

      expect(fetchDashboardsSpy).toHaveBeenCalled();
    });

    it('Enriches data requests', () => {
      filtersScene.setScope(mocks.scope1.metadata.uid);

      const queryRunner = sceneGraph.findObject(dashboardScene, (o) => o.state.key === 'data-query-runner')!;

      expect(dashboardScene.enrichDataRequest(queryRunner).scope).toEqual({
        ...mocks.scope1.metadata,
        ...mocks.scope1.spec,
      });
    });

    it('Toggles expanded state', async () => {
      await waitFor(() => expect(getDashboardsContainer()).not.toBeInTheDocument());

      scopesScene.toggleIsExpanded();

      expect(scopesScene.state.isExpanded).toEqual(true);

      await waitFor(() => expect(getDashboardsContainer()).toBeInTheDocument());
    });

    it('Enters view mode', async () => {
      dashboardScene.onEnterEditMode();

      expect(scopesScene.state.isViewing).toEqual(true);
      expect(scopesScene.state.isExpanded).toEqual(false);

      await waitFor(() => {
        expect(getToggleExpandButton()).not.toBeInTheDocument();
        expect(getDashboardsContainer()).not.toBeInTheDocument();
      });
    });

    it('Exits view mode', async () => {
      dashboardScene.onEnterEditMode();
      dashboardScene.exitEditMode({ skipConfirm: true });

      expect(scopesScene.state.isViewing).toEqual(false);
      expect(scopesScene.state.isExpanded).toEqual(false);

      await waitFor(() => expect(getToggleExpandButton()).toBeInTheDocument());
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

function getDashboardsContainer() {
  return screen.getByTestId('scopes-scene-dashboards-container');
}

function getToggleExpandButton() {
  return screen.queryByTestId('scopes-scene-toggle-expand-button');
}
