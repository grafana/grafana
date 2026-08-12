import { act, render } from '@testing-library/react';
import { BehaviorSubject } from 'rxjs';

import { CoreApp, type Scope } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { config, ScopesContext, type ScopesContextValue, setPluginImportUtils } from '@grafana/runtime';
import {
  sceneGraph,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  ScopesVariable,
  VizPanel,
} from '@grafana/scenes';

import { NotebookScene } from './NotebookScene';
import { NotebookCellItem } from './layout-notebook/NotebookCellItem';
import { NotebookLayoutManager } from './layout-notebook/NotebookLayoutManager';

// Rendering a cell activates its VizPanel, which loads its plugin.
setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

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

  describe('scopes', () => {
    const scope: Scope = {
      metadata: { name: 'cluster-1' },
      spec: { title: 'Cluster 1', filters: [{ key: 'cluster', value: 'cluster-1', operator: 'equals' }] },
    };

    afterEach(() => {
      config.featureToggles.scopeFilters = false;
    });

    function buildScopesContext(value: Scope[]): ScopesContextValue {
      const state = { drawerOpened: false, enabled: false, loading: false, readOnly: false, value };
      const stateObservable = new BehaviorSubject(state);

      return {
        get state() {
          return stateObservable.getValue();
        },
        stateObservable,
        changeScopes: jest.fn(),
        setReadOnly: jest.fn(),
        setEnabled: jest.fn((enabled: boolean) => stateObservable.next({ ...stateObservable.getValue(), enabled })),
      };
    }

    it('has no scopes variable when scopeFilters is off', () => {
      config.featureToggles.scopeFilters = false;

      expect(buildScene(false).state.$variables).toBeUndefined();
    });

    it('adds the scopes variable when scopeFilters is on', () => {
      config.featureToggles.scopeFilters = true;

      const variables = buildScene(false).state.$variables?.state.variables;

      expect(variables).toHaveLength(1);
      expect(variables?.[0]).toBeInstanceOf(ScopesVariable);
    });

    // The whole point: SceneQueryRunner reads scopes off the graph via lookupVariable('__scopes'),
    // so this resolving is what makes a notebook cell's query carry the selected scopes.
    it('resolves the selected scopes for a panel in a cell', async () => {
      config.featureToggles.scopeFilters = true;
      const { scene, panel } = buildSceneWithPanel();

      scene.activate();
      // act: rendering the cell activates its VizPanel, which loads its plugin asynchronously.
      await act(async () => {
        render(
          <ScopesContext.Provider value={buildScopesContext([scope])}>
            <scene.Component model={scene} />
          </ScopesContext.Provider>
        );
      });

      expect(sceneGraph.getScopes(panel)).toEqual([scope]);
    });

    // ScopesVariable starts with `loading: true` and only clears it once its renderer has handed it
    // the context. If the renderer stops mounting hidden variables, every query runner that depends
    // on it (SceneQueryRunner sets dependsOnScopes) waits forever and no cell ever loads. This
    // asserts the variable is settled, which is the condition query runners actually wait on.
    it('settles the scopes variable so query runners are not blocked', () => {
      config.featureToggles.scopeFilters = true;
      const scene = buildScene(false);
      const variable = scene.state.$variables!.state.variables[0];

      scene.activate();
      expect(variable.state.loading).toBe(true);

      render(
        <ScopesContext.Provider value={buildScopesContext([scope])}>
          <scene.Component model={scene} />
        </ScopesContext.Provider>
      );

      expect(variable.state.loading).toBe(false);
      expect(sceneGraph.hasVariableDependencyInLoadingState(scene.state.body.state.cells[0])).toBe(false);
    });

    // The variable is also what turns the selector on, so a notebook page has to enable scopes the
    // same way a dashboard does rather than inheriting whatever the previous route left behind.
    it('enables scopes while the notebook is mounted', () => {
      config.featureToggles.scopeFilters = true;
      const scene = buildScene(false);
      const context = buildScopesContext([scope]);

      scene.activate();
      render(
        <ScopesContext.Provider value={context}>
          <scene.Component model={scene} />
        </ScopesContext.Provider>
      );

      expect(context.setEnabled).toHaveBeenCalledWith(true);
    });
  });
});
