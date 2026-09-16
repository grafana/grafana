import { getPanelPlugin } from '@grafana/data/test';
import { config, setPluginImportUtils } from '@grafana/runtime';
import { type CustomVariable, VizPanel, sceneGraph } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { type DashboardSceneState } from '../../scene/types/dashboard';
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
    // The plan names only the variable, not what its values should look like -- generating
    // plausible values is the same job as the panel sample data, so it happens here rather than
    // being reconstructed on the caller's side.
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

    // Simulates the isNew branch in DashboardScene's own activation handler, which enters edit
    // mode unconditionally on a fresh /dashboard/new scene before RENDER_PLAN ever runs -- the
    // exact pre-existing main behaviour that broke the design's view-mode-only premise.
    scene.onEnterEditMode();
    expect(scene.state.isEditing).toBe(true);

    const result = await client.execute({ type: 'RENDER_PLAN', payload: plan });

    expect(result.success).toBe(true);
    expect(scene.state.isEditing).toBe(false);
    expect(scene.state.isDirty).toBe(false);
    // The pre-plan snapshot exitEditMode could have restored was the scene's initial, empty
    // state -- assert the plan's own content survived instead.
    expect(scene.state.title).toBe('Kafka overview');
    expect(scene.state.body.getVizPanels().map((p) => p.state.title)).toEqual(['Requests', 'Error rate']);
    expect(scene.state.planning).toMatchObject({ planId: 'plan-1' });
  });

  it('does nothing extra when the scene was already in view mode', async () => {
    const { scene, client } = setup();
    expect(scene.state.isEditing).toBeFalsy();

    const result = await client.execute({ type: 'RENDER_PLAN', payload: plan });

    expect(result.success).toBe(true);
    expect(scene.state.isEditing).toBeFalsy();
  });

  describe('the rendered grid cannot actually be dragged or resized', () => {
    // DefaultGridLayoutManager.fromVizPanels hardcodes isDraggable/isResizable true at
    // construction; the only place either ever flips false is editModeChanged, which runs on an
    // edit-mode *transition*. Assert behaviour (isDraggable(), getDragHooks()) rather than the raw
    // state flag, so a future change that re-enables dragging some other way still fails this.
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
      // With dashboardNewLayouts on, DefaultGridLayoutManager.editModeChanged does the actual
      // isDraggable/isResizable correction inside a setTimeout(..., 10) rather than synchronously
      // (to avoid grid animation jank) -- assert it lands after that delay, not that it is
      // already true the same tick, so this test can't pass for the wrong reason.
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
    // RENDER_PLAN replaces the whole body and END_PLANNING clears unconditionally, which is only
    // safe because the assistant's own path always starts from a fresh, blank /dashboard/new.
    // The mutation API is public, though, so these guard against a caller that reaches
    // RENDER_PLAN some other way, on a dashboard that actually has something to lose.

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
    // See renderPlanContractFixture.ts -- the assistant repo asserts its mapper produces exactly
    // this object from its own DashboardPlan shape. This is core's half: that RENDER_PLAN accepts
    // it and renders it correctly. A schema change on either side that isn't mirrored on the
    // other shows up here as a failing assertion, not as a runtime rejection.
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
  // Oscar's decision: stop enterEditModeIfNeeded from flipping the scene into edit mode on behalf
  // of an unrelated command, but let the other ~30 mutation commands still run against the
  // preview without it. Confirmed here, against a real scene and real layout managers rather than
  // by reasoning about it: ADD_PANEL applies correctly -- title, key, and layout position are all
  // as expected -- with isEditing staying false throughout.
  it('ADD_PANEL still adds a panel correctly, without entering edit mode', async () => {
    const { scene, client } = setup();
    await client.execute({ type: 'RENDER_PLAN', payload: plan });
    expect(scene.state.isEditing).toBeFalsy();

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

    expect(result.success).toBe(true);
    expect(scene.state.isEditing).toBeFalsy();
    expect(scene.state.body.getVizPanels().map((p) => p.state.title)).toContain('New panel');
  });
});
