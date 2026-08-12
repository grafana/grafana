import { act, render } from '@testing-library/react';
import { createMemoryHistory } from 'history';
import { BehaviorSubject } from 'rxjs';

import { CoreApp, type Scope } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import {
  config,
  HistoryWrapper,
  locationService,
  ScopesContext,
  type ScopesContextValue,
  setLocationService,
  setPluginImportUtils,
} from '@grafana/runtime';
import {
  sceneGraph,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  ScopesVariable,
  VizPanel,
} from '@grafana/scenes';
import { contextSrv } from 'app/core/services/context_srv';

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

// activate() registers the scene on window.__grafanaSceneContext; leaving it registered leaks into
// later tests in this file.
const deactivators: Array<() => void> = [];
function activate(scene: NotebookScene) {
  deactivators.push(scene.activate());
}

describe('NotebookScene', () => {
  afterEach(() => {
    deactivators.splice(0).forEach((deactivate) => deactivate());
  });

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

    activate(scene);

    expect(scene.state.refreshPicker.isActive).toBe(false);
  });

  describe('edit mode', () => {
    const originalLocationService = locationService;

    beforeEach(() => {
      // A memory history keeps the url assertions independent of whatever jsdom's location is.
      setLocationService(new HistoryWrapper(createMemoryHistory({ initialEntries: ['/notebooks/nb1'] })));
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    });

    afterEach(() => {
      setLocationService(originalLocationService);
      jest.restoreAllMocks();
    });

    it('starts in view mode', () => {
      expect(buildScene(false).state.isEditing).toBeUndefined();
    });

    it('enters edit mode and tells the layout', () => {
      const scene = buildScene(false);

      scene.onEnterEditMode();

      expect(scene.state.isEditing).toBe(true);
      // Asserted through the layout's own state rather than a spy, so the propagation is real.
      expect(scene.state.body.state.isEditing).toBe(true);
    });

    it('puts the mode in the url, so a reload or a copied link keeps it', () => {
      const scene = buildScene(false);

      scene.onEnterEditMode();

      // The raw search text, not getSearchObject(), which coerces 'true' to a boolean — the page
      // seeds off the literal string, and this is what a copied link carries.
      expect(locationService.getLocation().search).toContain('edit=true');
    });

    it('refuses a user without edit permission, whatever the caller', () => {
      // The url seeding calls this directly, so the guard cannot live only in the toggle.
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
      const scene = buildScene(false);

      scene.onEnterEditMode();

      expect(scene.state.isEditing).toBeUndefined();
      expect(scene.state.body.state.isEditing).toBeUndefined();
      expect(locationService.getLocation().search).not.toContain('edit');
    });

    it('leaves edit mode again, clearing the layout and the url', () => {
      const scene = buildScene(false);
      scene.onEnterEditMode();

      scene.onExitEditMode();

      expect(scene.state.isEditing).toBe(false);
      expect(scene.state.body.state.isEditing).toBe(false);
      expect(locationService.getLocation().search).not.toContain('edit');
    });
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

      activate(scene);
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

      activate(scene);
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

      activate(scene);
      render(
        <ScopesContext.Provider value={context}>
          <scene.Component model={scene} />
        </ScopesContext.Provider>
      );

      expect(context.setEnabled).toHaveBeenCalledWith(true);
    });
  });
});
