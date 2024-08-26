import { KBarProvider } from 'kbar';
import { render } from 'test/test-utils';

import {
  AdHocFiltersVariable,
  behaviors,
  GroupByVariable,
  sceneGraph,
  SceneGridItem,
  SceneGridLayout,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';
import { AppChrome } from 'app/core/components/AppChrome/AppChrome';
import { DashboardControls } from 'app/features/dashboard-scene/scene//DashboardControls';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { ScopesFacade } from '../../ScopesFacadeScene';
import { scopesDashboardsScene, scopesSelectorScene } from '../../instance';
import { getInitialDashboardsState } from '../../internal/ScopesDashboardsScene';
import { initialSelectorState } from '../../internal/ScopesSelectorScene';
import { DASHBOARDS_OPENED_KEY } from '../../internal/const';

export function buildTestScene(overrides: Partial<DashboardScene> = {}) {
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
    $behaviors: [
      new behaviors.CursorSync({}),
      new ScopesFacade({
        handler: (facade) => sceneGraph.getTimeRange(facade).onRefresh(),
      }),
    ],
    $variables: new SceneVariableSet({
      variables: [
        new AdHocFiltersVariable({
          name: 'adhoc',
          datasource: { uid: 'my-ds-uid' },
        }),
        new GroupByVariable({
          name: 'groupby',
          datasource: { uid: 'my-ds-uid' },
        }),
      ],
    }),
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

export function renderDashboard(dashboardScene: DashboardScene) {
  return render(
    <KBarProvider>
      <AppChrome>
        <dashboardScene.Component model={dashboardScene} />
      </AppChrome>
    </KBarProvider>
  );
}

export function resetScenes() {
  scopesSelectorScene?.setState(initialSelectorState);

  localStorage.removeItem(DASHBOARDS_OPENED_KEY);

  scopesDashboardsScene?.setState(getInitialDashboardsState());
}
