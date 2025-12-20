import { config } from '@grafana/runtime';
import { SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';

import { dashboardSceneJsonApiV2 } from './runtimeDashboardSceneJsonApiV2';

jest.mock('../utils/utils', () => {
  const actual = jest.requireActual('../utils/utils');
  return {
    ...actual,
    getDefaultVizPanel: jest.fn(),
  };
});

jest.mock('../pages/DashboardScenePageStateManager', () => ({
  getDashboardScenePageStateManager: jest.fn(),
}));

jest.mock('../utils/dashboardSceneGraph', () => ({
  dashboardSceneGraph: {
    getVizPanels: jest.fn(),
  },
}));

describe('dashboardSceneJsonApiV2 (ops)', () => {
  const { getDashboardScenePageStateManager } = jest.requireMock('../pages/DashboardScenePageStateManager');
  const { dashboardSceneGraph } = jest.requireMock('../utils/dashboardSceneGraph');
  const { getDefaultVizPanel } = jest.requireMock('../utils/utils');

  beforeEach(() => {
    jest.clearAllMocks();
    config.featureToggles.kubernetesDashboards = true;
    config.featureToggles.kubernetesDashboardsV2 = true;
  });

  it('mergePanelConfig updates fieldConfig defaults in-place (preserves SceneQueryRunner identity)', () => {
    const runner = new SceneQueryRunner({ queries: [], data: undefined });
    const panel = new VizPanel({
      key: 'panel-2',
      title: 'Time series',
      fieldConfig: { defaults: { unit: 'short' }, overrides: [] },
      $data: runner,
    });

    const dashboard = {
      state: { isEditing: true },
      setState: jest.fn(),
    };

    getDashboardScenePageStateManager.mockReturnValue({ state: { dashboard } });
    dashboardSceneGraph.getVizPanels.mockReturnValue([panel]);

    const res = JSON.parse(
      dashboardSceneJsonApiV2.applyCurrentDashboardOps(
        JSON.stringify([
          {
            op: 'mergePanelConfig',
            panelId: 2,
            merge: { vizConfig: { fieldConfig: { defaults: { unit: 'ms' } } } },
          },
        ])
      )
    );

    expect(res.ok).toBe(true);
    expect(res.applied).toBe(1);
    expect(panel.state.fieldConfig.defaults.unit).toBe('ms');
    expect(panel.state.$data).toBe(runner);
    expect(dashboard.setState).toHaveBeenCalledWith({ isDirty: true });
  });

  it('addPanel uses the current layout addPanel (does not rebuild existing panels)', () => {
    const existingRunner = new SceneQueryRunner({ queries: [], data: undefined });
    const existingPanel = new VizPanel({
      key: 'panel-1',
      title: 'Existing',
      $data: existingRunner,
      fieldConfig: { defaults: {}, overrides: [] },
    });

    const newRunner = new SceneQueryRunner({ queries: [], data: undefined });
    const newPanel = new VizPanel({
      // key is assigned by layout.addPanel in real code; the op reads it afterwards.
      title: 'New panel',
      $data: newRunner,
      fieldConfig: { defaults: {}, overrides: [] },
    });

    getDefaultVizPanel.mockReturnValue(newPanel);

    const layout = {
      addPanel: jest.fn((p: VizPanel) => {
        // emulate DefaultGridLayoutManager assigning next panel id/key
        p.setState({ key: 'panel-2' });
      }),
    };

    const dashboard = {
      state: { isEditing: true, body: layout },
      setState: jest.fn(),
      removePanel: jest.fn(),
    };

    getDashboardScenePageStateManager.mockReturnValue({ state: { dashboard } });
    dashboardSceneGraph.getVizPanels.mockReturnValue([existingPanel]);

    const res = JSON.parse(dashboardSceneJsonApiV2.applyCurrentDashboardOps(JSON.stringify([{ op: 'addPanel', title: 'Hello' }])));    
    expect(res.ok).toBe(true);
    expect(res.applied).toBe(1);
    expect(layout.addPanel).toHaveBeenCalledTimes(1);
    expect(newPanel.state.key).toBe('panel-2');

    // existing panel runner identity preserved
    expect(existingPanel.state.$data).toBe(existingRunner);
  });

  it('movePanelToRow supports moving into a GridLayout row (DefaultGridLayoutManager)', () => {
    const panel = new VizPanel({
      key: 'panel-6',
      title: 'Bar chart (steps)',
      pluginId: 'barchart',
      fieldConfig: { defaults: {}, overrides: [] },
      $data: new SceneQueryRunner({ queries: [], data: undefined }),
    });

    const rowA = new RowItem({ title: 'Charts', layout: DefaultGridLayoutManager.fromVizPanels([panel]) });
    const rowB = new RowItem({ title: 'Data', layout: DefaultGridLayoutManager.fromVizPanels([]) });
    const rows = new RowsLayoutManager({ rows: [rowA, rowB] });

    const dashboard = {
      state: { isEditing: true, body: rows },
      setState: jest.fn(),
    };

    getDashboardScenePageStateManager.mockReturnValue({ state: { dashboard } });
    dashboardSceneGraph.getVizPanels.mockReturnValue([panel]);

    const res = JSON.parse(
      dashboardSceneJsonApiV2.applyCurrentDashboardOps(JSON.stringify([{ op: 'movePanelToRow', panelId: 6, rowTitle: 'Data' }]))
    );

    expect(res.ok).toBe(true);
    expect(res.applied).toBe(1);
    expect(rowA.state.layout.getVizPanels()).toHaveLength(0);
    expect(rowB.state.layout.getVizPanels()).toContain(panel);
  });
});


