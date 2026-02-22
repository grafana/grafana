import { SceneGridLayout, SceneQueryRunner, SceneTimeRange, SceneVariableSet, VizPanel } from '@grafana/scenes';

import { DashboardEditActionEvent } from '../../edit-pane/shared';
import { getQueryRunnerFor } from '../../utils/utils';
import { DashboardScene } from '../DashboardScene';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';

import { AutoGridItem } from './AutoGridItem';
import { AutoGridLayout } from './AutoGridLayout';
import { AutoGridLayoutManager } from './AutoGridLayoutManager';

describe('AutoGridLayoutManager', () => {
  it('can remove panel', () => {
    const { manager, panel1 } = setup();

    manager.subscribeToEvent(DashboardEditActionEvent, (event) => {
      event.payload.perform();
    });

    manager.removePanel(panel1);

    expect(manager.state.layout.state.children.length).toBe(1);
  });
  describe('Layout conversion preserves panel config', () => {
    it('preserves panel pluginId, title, query and options when switching from custom grid to auto grid', () => {
      const dashboard = setupSceneWithCustomGrid();

      switchToAutoGrid(dashboard);

      const panels = dashboard.state.body.getVizPanels();
      expect(panels).toHaveLength(1);
      expect(panels[0].state.pluginId).toBe(panelPluginId);
      expect(panels[0].state.title).toBe(panelTitle);
      expect(panels[0].state.options).toEqual(panelOptions);
    });

    it('preserves panel queries when switching from custom grid to auto grid', () => {
      const dashboard = setupSceneWithCustomGrid();

      switchToAutoGrid(dashboard);

      const panels = dashboard.state.body.getVizPanels();
      const runner = getQueryRunnerFor(panels[0]);
      expect(runner).toBeDefined();
      expect(runner?.state.queries).toEqual(queries);
    });
  });
});

export function setup() {
  const panel1 = new VizPanel({
    title: 'Panel A',
    key: 'panel-1',
    pluginId: 'table',
    $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
  });

  const panel2 = new VizPanel({
    title: 'Panel A',
    key: 'panel-1',
    pluginId: 'table',
    $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
  });

  const gridItems = [
    new AutoGridItem({
      key: 'grid-item-1',
      body: panel1,
    }),
    new AutoGridItem({
      key: 'grid-item-2',
      body: new VizPanel({
        title: 'Panel B',
        key: 'panel-2',
        pluginId: 'table',
      }),
    }),
  ];

  const manager = new AutoGridLayoutManager({ layout: new AutoGridLayout({ children: gridItems }) });

  new DashboardScene({ body: manager });

  return { manager, panel1, panel2 };
}

const panelOptions = { legend: { displayMode: 'list', placement: 'bottom' } };
const panelTitle = 'Test panel';
const panelPluginId = 'timeseries';
const queries = [{ refId: 'A', datasource: { type: 'test', uid: 'ds1' } }];

function setupSceneWithCustomGrid() {
  const vizPanel = new VizPanel({
    key: 'panel-1',
    pluginId: panelPluginId,
    title: panelTitle,
    options: panelOptions,
    $data: new SceneQueryRunner({ key: 'test', queries }),
  });

  return new DashboardScene({
    $variables: new SceneVariableSet({ variables: [] }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    isEditing: true,
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [
          new DashboardGridItem({
            key: 'griditem-1',
            x: 0,
            y: 0,
            width: 8,
            height: 6,
            body: vizPanel,
          }),
        ],
      }),
    }),
  });
}

function switchToAutoGrid(dashboard: DashboardScene) {
  const previousBody = dashboard.state.body;
  const newLayout = AutoGridLayoutManager.createFromLayout(previousBody);
  dashboard.switchLayout(newLayout, true);
}
