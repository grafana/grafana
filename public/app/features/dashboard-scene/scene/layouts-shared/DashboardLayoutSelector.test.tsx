import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneGridLayout, VizPanel, SceneVariableSet, SceneTimeRange, SceneQueryRunner } from '@grafana/scenes';

import { activateFullSceneTree } from '../../utils/test-utils';
import { getQueryRunnerFor } from '../../utils/utils';
import { DashboardScene } from '../DashboardScene';
import { AutoGridItem } from '../layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { LayoutParent } from '../types/LayoutParent';

import { DashboardLayoutSelector } from './DashboardLayoutSelector';

setPluginImportUtils({
  importPanelPlugin: (_) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (_) => undefined,
});

describe('DashboardLayoutSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not show confirmation modal when switching tabs and rows layouts', async () => {
    const user = userEvent.setup();
    const scene = buildTestScene();
    const layoutManager = scene.state.body;
    const spy = jest.spyOn(layoutManager.parent as LayoutParent, 'switchLayout');

    render(<DashboardLayoutSelector layoutManager={layoutManager} />);

    await user.click(screen.getByLabelText('layout-selection-option-Tabs'));
    expect(screen.queryByTestId(selectors.pages.ConfirmModal.delete)).not.toBeInTheDocument();
    expect(spy).toHaveBeenCalled();
  });

  it('should show confirmation modal when switching grid layouts', async () => {
    const user = userEvent.setup();
    const scene = buildTestScene();
    const layoutManager = scene.state.body.state.rows[0].state.layout;
    const spy = jest.spyOn(layoutManager.parent as LayoutParent, 'switchLayout');

    render(<DashboardLayoutSelector layoutManager={layoutManager} />);

    await user.click(screen.getByLabelText('layout-selection-option-Auto grid'));
    let confirmButton = screen.getByTestId(selectors.pages.ConfirmModal.delete);
    expect(confirmButton).toBeInTheDocument();

    await user.click(confirmButton);
    expect(spy).toHaveBeenCalled();
  });

  it('should disable tabs option when a row contains tabs layout and show correct message', async () => {
    const scene = buildTestSceneWithNestedTabs();
    const layoutManager = scene.state.body;

    render(<DashboardLayoutSelector layoutManager={layoutManager} />);

    const tabsOption = screen.getByLabelText('layout-selection-option-Tabs');
    expect(tabsOption).toBeDisabled();
    expect(screen.getByTitle('Cannot change to tabs because a row already contains tabs')).toBeInTheDocument();
  });

  it('should not disable tabs option when rows do not contain tabs', async () => {
    const scene = buildTestScene();
    const layoutManager = scene.state.body;

    render(<DashboardLayoutSelector layoutManager={layoutManager} />);

    const tabsOption = screen.getByLabelText('layout-selection-option-Tabs');
    expect(tabsOption).not.toBeDisabled();
  });

  describe('Layout conversion preserves panel config', () => {
    const panelOptions = { legend: { displayMode: 'list', placement: 'bottom' } };
    const panelTitle = 'Test panel';
    const panelPluginId = 'timeseries';
    const queries = [{ refId: 'A', datasource: { type: 'test', uid: 'ds1' } }];

    function buildSceneWithOnePanel(layoutType: 'custom' | 'auto' = 'custom') {
      const vizPanel = new VizPanel({
        key: 'panel-1',
        pluginId: panelPluginId,
        title: panelTitle,
        options: panelOptions,
        $data: new SceneQueryRunner({ key: 'test', queries }),
      });

      const layout = layoutType === 'custom' ? customLayout(vizPanel) : autoLayout(vizPanel);

      return new DashboardScene({
        $variables: new SceneVariableSet({ variables: [] }),
        $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
        isEditing: true,
        body: layout,
      });
    }

    it('preserves panel pluginId, title, query and options when switching from custom grid to auto grid', () => {
      const dashboard = buildSceneWithOnePanel('custom');
      const previousBody = dashboard.state.body;

      const newLayout = AutoGridLayoutManager.createFromLayout(previousBody);
      dashboard.switchLayout(newLayout, true);

      const panels = dashboard.state.body.getVizPanels();
      expect(panels).toHaveLength(1);
      expect(panels[0].state.pluginId).toBe(panelPluginId);
      expect(panels[0].state.title).toBe(panelTitle);
      expect(panels[0].state.options).toEqual(panelOptions);
    });

    it('preserves panel queries when switching from custom grid to auto grid', () => {
      const dashboard = buildSceneWithOnePanel('custom');
      const previousBody = dashboard.state.body;

      const newLayout = AutoGridLayoutManager.createFromLayout(previousBody);
      dashboard.switchLayout(newLayout, true);

      const panels = dashboard.state.body.getVizPanels();
      const runner = getQueryRunnerFor(panels[0]);
      expect(runner).toBeDefined();
      expect(runner?.state.queries).toEqual(queries);
    });

    it('preserves panel options when switching from auto grid to custom grid', () => {
      const dashboard = buildSceneWithOnePanel('auto');
      const autoLayout = dashboard.state.body;

      const customLayout = DefaultGridLayoutManager.createFromLayout(autoLayout);
      dashboard.switchLayout(customLayout, true);

      const panels = dashboard.state.body.getVizPanels();
      expect(panels).toHaveLength(1);
      expect(panels[0].state.pluginId).toBe(panelPluginId);
      expect(panels[0].state.title).toBe(panelTitle);
      expect(panels[0].state.options).toEqual(panelOptions);
    });

    it('preserves panel queries when switching from auto grid to custom grid', () => {
      const dashboard = buildSceneWithOnePanel('auto');
      const previousBody = dashboard.state.body;

      const newLayout = DefaultGridLayoutManager.createFromLayout(previousBody);
      dashboard.switchLayout(newLayout, true);

      const panels = dashboard.state.body.getVizPanels();
      const runner = getQueryRunnerFor(panels[0]);
      expect(runner).toBeDefined();
      expect(runner?.state.queries).toEqual(queries);
    });
  });
});

const buildTestScene = () => {
  const scene = new DashboardScene({
    title: 'testScene',
    editable: true,
    $variables: new SceneVariableSet({
      variables: [],
    }),
    body: new RowsLayoutManager({
      rows: [
        new RowItem({
          title: 'Row 1',
          layout: new DefaultGridLayoutManager({
            grid: new SceneGridLayout({
              children: [
                new DashboardGridItem({
                  body: new VizPanel({ key: 'panel-1', pluginId: 'text' }),
                }),
              ],
            }),
          }),
        }),
      ],
    }),
  });

  activateFullSceneTree(scene);
  return scene;
};

const buildTestSceneWithNestedTabs = () => {
  const scene = new DashboardScene({
    title: 'testScene',
    editable: true,
    $variables: new SceneVariableSet({
      variables: [],
    }),
    body: new RowsLayoutManager({
      rows: [
        new RowItem({
          title: 'Row 1',
          layout: new DefaultGridLayoutManager({
            grid: new SceneGridLayout({
              children: [
                new DashboardGridItem({
                  body: new VizPanel({ key: 'panel-1', pluginId: 'text' }),
                }),
              ],
            }),
          }),
        }),
        new RowItem({
          title: 'Row with Tabs',
          layout: new TabsLayoutManager({
            tabs: [
              new TabItem({
                title: 'Tab 1',
                layout: AutoGridLayoutManager.createEmpty(),
              }),
            ],
          }),
        }),
      ],
    }),
  });

  activateFullSceneTree(scene);
  return scene;
};

function customLayout(panel: VizPanel) {
  return new DefaultGridLayoutManager({
    grid: new SceneGridLayout({
      children: [
        new DashboardGridItem({
          key: 'griditem-1',
          x: 0,
          y: 0,
          width: 8,
          height: 6,
          body: panel,
        }),
      ],
    }),
  });
}

function autoLayout(panel: VizPanel) {
  return new AutoGridLayoutManager({
    layout: new AutoGridLayout({
      children: [
        new AutoGridItem({
          key: 'auto-grid-item-1',
          body: panel,
        }),
      ],
    }),
  });
}
