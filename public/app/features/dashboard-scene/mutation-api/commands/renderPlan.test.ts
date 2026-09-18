import { getPanelPlugin } from '@grafana/data/test';
import { config, setPluginImportUtils } from '@grafana/runtime';
import { type CustomVariable, VizPanel, sceneGraph } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { type DashboardSceneState } from '../../scene/types/dashboard';
import { AddNewPane } from '../../sidebar/add-new/AddNewPane';
import { getQueryRunnerFor } from '../../utils/getQueryRunnerFor';
import { DashboardMutationClient } from '../DashboardMutationClient';

import { renderPlanContractFixture } from './renderPlanContractFixture';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({ id })),
  getPanelPluginFromCache: (id: string) => getPanelPlugin({ id }),
});

let cleanUpPreviousScene = () => {};

function setup(overrides: Partial<DashboardSceneState> = {}) {
  cleanUpPreviousScene();
  const scene = new DashboardScene({ title: 'hello', meta: { canEdit: true }, ...overrides });
  cleanUpPreviousScene = scene.activate();
  const client = new DashboardMutationClient(scene);
  return { scene, client };
}

afterEach(() => {
  cleanUpPreviousScene();
  cleanUpPreviousScene = () => {};
});

const plan = {
  planId: 'plan-1',
  title: 'Kafka overview',
  layout: 'rows' as const,
  sections: [
    { title: 'Throughput', panels: [{ title: 'Requests', vizType: 'timeseries' }] },
    { title: 'Errors', panels: [{ title: 'Error rate', vizType: 'timeseries' }] },
  ],
};

describe('RENDER_PLAN', () => {
  it('renders the whole plan in one call: rows, panels, and planning state', async () => {
    const { scene, client } = setup();

    const result = await client.execute({ type: 'RENDER_PLAN', payload: plan });

    expect(result.success).toBe(true);
    expect(scene.state.title).toBe('Kafka overview');
    expect(scene.state.body).toBeInstanceOf(RowsLayoutManager);
    const rows = (scene.state.body as RowsLayoutManager).state.rows;
    expect(rows.map((r) => r.state.title)).toEqual(['Throughput', 'Errors']);
    expect(scene.state.body.getVizPanels().map((p) => p.state.title)).toEqual(['Requests', 'Error rate']);
    expect(scene.state.planning).toMatchObject({ planId: 'plan-1', planTitle: 'Kafka overview', panelCount: 2 });
  });

  it('builds query-less placeholder panels with sample data, not a live query runner', async () => {
    const { scene, client } = setup();

    await client.execute({ type: 'RENDER_PLAN', payload: plan });

    const panel = scene.state.body.getVizPanels()[0];
    expect(getQueryRunnerFor(panel)).toBeUndefined();
    expect(sceneGraph.getData(panel).state.data?.series[0]).toBeDefined();
  });

  it('builds panels with no dropdown menu at all -- View is not read-only in practice', async () => {
    // A plugin's View pane can expose a Quick toggles section (timeseries sets
    // .setViewPanelOptions) that mutates panel options, with no isPlanning() gate. The menu is
    // cleared entirely rather than guarded, so there is no button at all.
    const { scene, client } = setup();

    await client.execute({ type: 'RENDER_PLAN', payload: plan });

    const panel = scene.state.body.getVizPanels()[0];
    expect(panel.state.menu).toBeUndefined();
  });

  it('renders tabs when layout is "tabs"', async () => {
    const { scene, client } = setup();

    await client.execute({ type: 'RENDER_PLAN', payload: { ...plan, layout: 'tabs' } });

    expect(scene.state.body).toBeInstanceOf(TabsLayoutManager);
    expect((scene.state.body as TabsLayoutManager).state.tabs.map((t) => t.state.title)).toEqual([
      'Throughput',
      'Errors',
    ]);
  });

  it('renders stand-in variables alongside the plan, with generated sample values', async () => {
    // The plan names only the variable, not what its values should look like -- sample values
    // are generated here rather than by the caller.
    const { scene, client } = setup();

    await client.execute({
      type: 'RENDER_PLAN',
      payload: { ...plan, variables: ['env'] },
    });

    const variable = scene.state.$variables?.state.variables[0];
    expect(variable?.state.name).toBe('env');
    expect((variable as CustomVariable).state.query.length).toBeGreaterThan(0);
  });

  it('refuses when the scene is no longer open', async () => {
    const { scene, client } = setup();
    cleanUpPreviousScene();
    cleanUpPreviousScene = () => {};

    const result = await client.execute({ type: 'RENDER_PLAN', payload: plan });

    expect(result).toMatchObject({ success: false, error: 'The preview dashboard is no longer open.' });
    expect(scene.state.planning).toBeUndefined();
  });

  it('leaves the scene in view mode even though /dashboard/new enters edit mode on activation, and preserves the rendered plan rather than restoring the pre-plan snapshot', async () => {
    const { scene, client } = setup();

    // A fresh /dashboard/new scene enters edit mode unconditionally on activation, before
    // RENDER_PLAN ever runs.
    scene.onEnterEditMode();
    scene.state.sidebar.openPane(new AddNewPane({}));
    expect(scene.state.isEditing).toBe(true);
    expect(scene.state.sidebar.state.openPane?.getId()).toBe('add');
    scene.setState({ isDirty: true });

    const result = await client.execute({ type: 'RENDER_PLAN', payload: plan });

    expect(result.success).toBe(true);
    expect(scene.state.isEditing).toBe(false);
    expect(scene.state.isDirty).toBe(false);
    expect(scene.state.sidebar.state.openPane).toBeUndefined();
    // Assert the plan's own content survived, not the empty pre-plan snapshot.
    expect(scene.state.title).toBe('Kafka overview');
    expect(scene.state.body.getVizPanels().map((p) => p.state.title)).toEqual(['Requests', 'Error rate']);
    expect(scene.state.planning).toMatchObject({ planId: 'plan-1' });
  });

  it('preserves an editing dashboard with real panels when the preview is refused', async () => {
    const panel = new VizPanel({ title: 'User panel', pluginId: 'timeseries' });
    const { scene, client } = setup({ body: DefaultGridLayoutManager.fromVizPanels([panel]) });
    scene.onEnterEditMode();
    scene.setState({ title: 'User dashboard', description: 'Keep this description', isDirty: true });
    const sidebar = scene.state.sidebar;
    const closePane = jest.spyOn(sidebar, 'closePane');

    const result = await client.execute({ type: 'RENDER_PLAN', payload: plan });

    expect(result.success).toBe(false);
    expect(scene.state).toMatchObject({
      title: 'User dashboard',
      description: 'Keep this description',
      isEditing: true,
      isDirty: true,
    });
    expect(scene.state.body.getVizPanels()).toEqual([panel]);
    expect(closePane).not.toHaveBeenCalled();
  });

  it('does nothing extra when the scene was already in view mode', async () => {
    const { scene, client } = setup();
    expect(scene.state.isEditing).toBeFalsy();

    const result = await client.execute({ type: 'RENDER_PLAN', payload: plan });

    expect(result.success).toBe(true);
    expect(scene.state.isEditing).toBeFalsy();
  });

  describe('the rendered grid cannot actually be dragged or resized', () => {
    // DefaultGridLayoutManager hardcodes isDraggable/isResizable true; only editModeChanged (an
    // edit-mode transition) ever sets them false. Assert behaviour, not the raw flag, so a
    // future change that re-enables dragging some other way still fails this.
    function getGrid(scene: DashboardScene) {
      const rows = (scene.state.body as RowsLayoutManager).state.rows;
      return (rows[0].getLayout() as DefaultGridLayoutManager).state.grid;
    }

    it('on the marker path, where the scene never entered edit mode at all', async () => {
      const { scene, client } = setup();
      expect(scene.state.isEditing).toBeFalsy();

      await client.execute({ type: 'RENDER_PLAN', payload: plan });

      const grid = getGrid(scene);
      expect(grid.isDraggable()).toBe(false);
      expect(grid.getDragHooks()).toEqual({});
      expect(grid.state.isResizable).toBe(false);
    });

    it('on the fallback path, where the scene entered edit mode before RENDER_PLAN ran', async () => {
      const { scene, client } = setup();
      scene.onEnterEditMode();

      await client.execute({ type: 'RENDER_PLAN', payload: plan });

      const grid = getGrid(scene);
      expect(grid.isDraggable()).toBe(false);
      expect(grid.getDragHooks()).toEqual({});
      expect(grid.state.isResizable).toBe(false);
    });

    it('lands even when dashboardNewLayouts defers the correction behind a 10ms timeout', async () => {
      // With dashboardNewLayouts on, the correction lands inside a setTimeout(..., 10), not
      // synchronously -- assert it after that delay, not the same tick.
      const originalToggle = config.featureToggles.dashboardNewLayouts;
      config.featureToggles.dashboardNewLayouts = true;
      try {
        const { scene, client } = setup();

        await client.execute({ type: 'RENDER_PLAN', payload: plan });
        await new Promise((resolve) => setTimeout(resolve, 20));

        const grid = getGrid(scene);
        expect(grid.isDraggable()).toBe(false);
        expect(grid.getDragHooks()).toEqual({});
        expect(grid.state.isResizable).toBe(false);
      } finally {
        config.featureToggles.dashboardNewLayouts = originalToggle;
      }
    });
  });

  describe('precondition: refuses any target that is not a blank, unsaved dashboard', () => {
    // RENDER_PLAN replaces the whole body and END_PLANNING clears unconditionally -- safe only
    // if the target was already blank and unsaved. These guard against a caller that reaches
    // RENDER_PLAN some other way, on a dashboard that has something to lose.

    it('refuses a dashboard that already has panels, and leaves them untouched', async () => {
      const existingPanel = new VizPanel({ key: 'panel-1', title: 'Existing panel', pluginId: 'timeseries' });
      const { scene, client } = setup({ body: DefaultGridLayoutManager.fromVizPanels([existingPanel]) });

      const result = await client.execute({ type: 'RENDER_PLAN', payload: plan });

      expect(result).toMatchObject({ success: false });
      expect(scene.state.title).toBe('hello');
      expect(scene.state.body.getVizPanels().map((p) => p.state.title)).toEqual(['Existing panel']);
      expect(scene.state.planning).toBeUndefined();
    });

    it('refuses a dirty dashboard, even with no panels', async () => {
      const { scene, client } = setup();
      scene.setState({ isDirty: true });

      const result = await client.execute({ type: 'RENDER_PLAN', payload: plan });

      expect(result).toMatchObject({ success: false });
      expect(scene.state.planning).toBeUndefined();
    });

    it('refuses a saved dashboard (has a uid), even if blank and not dirty', async () => {
      const { scene, client } = setup({ uid: 'existing-dash-uid' });

      const result = await client.execute({ type: 'RENDER_PLAN', payload: plan });

      expect(result).toMatchObject({ success: false });
      expect(scene.state.planning).toBeUndefined();
    });

    it('succeeds against a blank, unsaved, non-dirty dashboard -- the only case the product uses', async () => {
      const { scene, client } = setup();

      const result = await client.execute({ type: 'RENDER_PLAN', payload: plan });

      expect(result.success).toBe(true);
      expect(scene.state.planning).toBeDefined();
    });

    it('does not refuse a re-render of an already-planning scene, even though it now has panels', async () => {
      const { scene, client } = setup();
      await client.execute({ type: 'RENDER_PLAN', payload: plan });
      expect(scene.state.body.getVizPanels().length).toBeGreaterThan(0);

      const result = await client.execute({
        type: 'RENDER_PLAN',
        payload: { ...plan, planId: 'plan-2', title: 'Replacement' },
      });

      expect(result.success).toBe(true);
      expect(scene.state.title).toBe('Replacement');
    });
  });

  it('only notifies the most recent plan: a stale onBuild/onDismiss closure is a no-op', async () => {
    const { scene, client } = setup();

    await client.execute({ type: 'RENDER_PLAN', payload: plan });
    const stalePlanning = scene.state.planning;
    expect(stalePlanning).toBeDefined();

    // A second render replaces the first plan before the stale closure ever fires.
    await client.execute({ type: 'RENDER_PLAN', payload: { ...plan, planId: 'plan-2', title: 'Replacement' } });

    expect(() => stalePlanning?.onBuild()).not.toThrow();
    expect(scene.state.planning?.planId).toBe('plan-2');
  });

  it("CONTRACT: accepts and renders the fixture payload the assistant's mapper is expected to produce", async () => {
    // See renderPlanContractFixture.ts: the assistant repo asserts its mapper produces exactly
    // this object. This is core's half, that RENDER_PLAN accepts and renders it correctly.
    const { scene, client } = setup();

    const result = await client.execute({ type: 'RENDER_PLAN', payload: renderPlanContractFixture });

    expect(result.success).toBe(true);
    expect(scene.state.title).toBe(renderPlanContractFixture.title);
    expect(scene.state.description).toBe(renderPlanContractFixture.description);
    expect(scene.state.body).toBeInstanceOf(RowsLayoutManager);
    expect((scene.state.body as RowsLayoutManager).state.rows.map((r) => r.state.title)).toEqual(
      renderPlanContractFixture.sections.map((s) => s.title)
    );
    expect(scene.state.body.getVizPanels().map((p) => p.state.title)).toEqual(
      renderPlanContractFixture.sections.flatMap((s) => s.panels.map((p) => p.title))
    );
    expect(scene.state.$variables?.state.variables.map((v) => v.state.name)).toEqual(
      renderPlanContractFixture.variables
    );
  });
});

describe('other mutation commands, while a plan preview is active', () => {
  // A planning scene is not a mutation target: DashboardMutationClient refuses every mutating
  // command except RENDER_PLAN/END_PLANNING (see DashboardMutationClient.test.ts). Covered here
  // too, so RENDER_PLAN's own test suite proves the isPlanning() it sets actually blocks a write.
  it('ADD_PANEL is refused, not applied', async () => {
    const { scene, client } = setup();
    await client.execute({ type: 'RENDER_PLAN', payload: plan });
    const panelCountBefore = scene.state.body.getVizPanels().length;

    const result = await client.execute({
      type: 'ADD_PANEL',
      payload: {
        panel: {
          kind: 'Panel',
          spec: {
            title: 'New panel',
            vizConfig: { group: 'timeseries', spec: { options: {}, fieldConfig: { defaults: {}, overrides: [] } } },
            data: { kind: 'QueryGroup', spec: { queries: [], transformations: [], queryOptions: {} } },
          },
        },
      },
    });

    expect(result.success).toBe(false);
    expect(scene.state.body.getVizPanels()).toHaveLength(panelCountBefore);
  });
});
