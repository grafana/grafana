import { CoreApp } from '@grafana/data';
import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange, VizPanel } from '@grafana/scenes';

import { NotebookScene } from './NotebookScene';
import { NotebookCellItem } from './layout-notebook/NotebookCellItem';
import { NotebookLayoutManager } from './layout-notebook/NotebookLayoutManager';

function buildScene(hideTimeControls: boolean) {
  return new NotebookScene({
    title: 'My notebook',
    body: new NotebookLayoutManager({
      cells: [
        new NotebookCellItem({
          elementName: 'md1',
          source: 'assistant',
          content: { kind: 'Markdown', spec: { text: 'Hello' } },
        }),
      ],
    }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({ refresh: '10s', intervals: ['10s', '1m'] }),
    hideTimeControls,
  });
}

describe('NotebookScene', () => {
  // activate() only propagates to $timeRange/$variables/$data/$behaviors; the pickers are plain
  // state and are otherwise activated by their renderers. With the controls row hidden nothing
  // renders the refresh picker, so without an explicit activation its interval never starts and the
  // spec's autoRefresh silently does nothing.
  it('activates the refresh picker when the time controls are hidden', () => {
    const scene = buildScene(true);

    const deactivate = scene.activate();

    expect(scene.state.refreshPicker.isActive).toBe(true);

    deactivate();
    expect(scene.state.refreshPicker.isActive).toBe(false);
  });

  it('leaves the refresh picker to its renderer when the time controls are shown', () => {
    const scene = buildScene(false);

    scene.activate();

    expect(scene.state.refreshPicker.isActive).toBe(false);
  });

  describe('enrichDataRequest', () => {
    function buildSceneWithPanel() {
      const panel = new VizPanel({ key: 'panel-4', title: 'Checkout latency', pluginId: 'timeseries' });
      const scene = new NotebookScene({
        title: 'My notebook',
        body: new NotebookLayoutManager({
          cells: [new NotebookCellItem({ elementName: 'latency', source: 'user', body: panel })],
        }),
        $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
        timePicker: new SceneTimePicker({}),
        refreshPicker: new SceneRefreshPicker({}),
      });

      return { scene, panel };
    }

    // Notebook queries have to be attributable. CoreApp.Unknown cannot be told apart from a
    // genuinely unattributed query, and CoreApp.Dashboard is a behavioural branch (SqlDatasource
    // skips grafana_sql_query_executed for it), not just a label.
    it('attributes queries to the notebook app', () => {
      const { scene, panel } = buildSceneWithPanel();

      expect(scene.enrichDataRequest(panel).app).toBe(CoreApp.Notebook);
    });

    // Root-agnostic: getClosestVizPanel/getPanelIdForVizPanel only walk parents, so there is no
    // reason for a notebook to drop the per-panel attribution a dashboard sends. panelId in
    // particular feeds per-panel query caching.
    it('carries the panel identity', () => {
      const { scene, panel } = buildSceneWithPanel();

      expect(scene.enrichDataRequest(panel)).toMatchObject({
        panelId: 4,
        panelName: 'Checkout latency',
        panelPluginId: 'timeseries',
      });
    });

    // dashboardUID is deliberately absent — a notebook is not a dashboard, and sending its uid
    // there would misattribute the query in datasource-side telemetry.
    it('does not send a dashboardUID', () => {
      const { scene, panel } = buildSceneWithPanel();

      expect(scene.enrichDataRequest(panel)).not.toHaveProperty('dashboardUID');
    });
  });
});
