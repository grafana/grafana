import { getPanelPlugin } from '@grafana/data/test';
import { config, locationService, setPluginImportUtils } from '@grafana/runtime';
import { CustomVariable, sceneGraph, SceneVariableSet, SceneQueryRunner, VizPanel } from '@grafana/scenes';
import { appEvents } from 'app/core/app_events';

import { groupSelectionInto } from '../../actions/layout/groupSelectionInto';
import { DashboardScene } from '../../scene/DashboardScene';
import { PlanPlaceholderBadge } from '../../scene/PlanPlaceholderBadge';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { addNewRowTo, addNewTabTo } from '../../scene/layouts-shared/addNew';
import { changeLayoutTo } from '../../scene/layouts-shared/utils';
import { DashboardPlanningEvent } from '../../scene/planningEvents';
import { deactivatePlanningSession } from '../../scene/planningSession';
import { type DashboardEditView } from '../../settings/utils';
import { getQueryRunnerFor } from '../../utils/getQueryRunnerFor';
import { getDefaultVizPanel } from '../../utils/utils';
import { DashboardMutationClient } from '../DashboardMutationClient';

jest.mock('../../actions/utils/edit', () => ({ edit: ({ perform }: { perform: () => void }) => perform() }));
jest.mock('../../actions/element/addElement', () => ({
  addElement: ({ perform }: { perform: () => void }) => perform(),
}));
jest.mock('../../actions/element/removeElement', () => ({
  removeElement: ({ perform }: { perform: () => void }) => perform(),
}));

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({ id })),
  getPanelPluginFromCache: (id: string) => getPanelPlugin({ id }),
});

// Deactivates the previous test's scene before a new one activates — real DashboardScene
// activation registers a global macro under a fixed name, which throws "already registered" if
// two activated scenes coexist (see SaveDashboardDrawer.test.tsx for the same pattern).
let cleanUpPreviousScene = () => {};

function setup() {
  cleanUpPreviousScene();
  const scene = new DashboardScene({
    title: 'Preview',
    isEditing: true,
    meta: { canEdit: true },
    body: DefaultGridLayoutManager.fromVizPanels([]),
    $variables: new SceneVariableSet({ variables: [] }),
  });
  jest.spyOn(scene, 'activateSidebar').mockImplementation(() => {});
  jest.spyOn(scene, 'forceRender').mockImplementation(() => {});
  cleanUpPreviousScene = scene.activate();
  const client = new DashboardMutationClient(scene);
  return { scene, client };
}
const start = { type: 'START_PLANNING', payload: { planId: 'plan-1', planTitle: 'Health', panelCount: 2 } };
const panel = {
  title: 'CPU usage',
  vizConfig: { group: 'timeseries', spec: { options: {}, fieldConfig: { defaults: {}, overrides: [] } } },
  data: { kind: 'QueryGroup', spec: { queries: [], transformations: [], queryOptions: {} } },
};
const flag = config.featureToggles.dashboardNewLayouts;
beforeEach(() => {
  config.featureToggles.dashboardNewLayouts = true;
});
afterEach(() => {
  config.featureToggles.dashboardNewLayouts = flag;
  jest.restoreAllMocks();
});

it('enters planning, generates sample data, reads it through the API and retains panels on build', async () => {
  const { scene, client } = setup();
  expect((await client.execute(start)).success).toBe(true);
  const added = await client.execute({
    type: 'ADD_PANEL',
    planId: 'plan-1',
    payload: { panel: { kind: 'Panel', spec: panel } },
  });
  expect(added.error).toBeUndefined();
  expect(added.success).toBe(true);
  const viz = scene.state.body.getVizPanels()[0];
  expect(getQueryRunnerFor(viz)).toBeUndefined();
  expect(sceneGraph.getData(viz).state.data?.series[0].length).toBe(60);
  const layout = await client.execute({ type: 'GET_LAYOUT', payload: {}, planId: 'plan-1' });
  expect(layout.success).toBe(true);
  expect(JSON.stringify(layout.data)).toContain('CPU usage');
  expect(JSON.stringify(layout.data)).not.toContain('pod-a1b2');
  expect(
    (await client.execute({ type: 'END_PLANNING', planId: 'plan-1', payload: { planId: 'plan-1', discard: false } }))
      .success
  ).toBe(true);
  expect(scene.isPlanning()).toBe(false);
  expect(scene.state.body.getVizPanels()).toEqual([viz]);
});

it('refuses stale reads, writes and decisions against another preview', async () => {
  const { scene, client } = setup();
  await client.execute(start);
  for (const type of ['GET_LAYOUT', 'ADD_PANEL', 'END_PLANNING']) {
    const result = await client.execute({ type, planId: 'old-plan', payload: {} });
    expect(result).toMatchObject({ success: false, error: 'The preview dashboard is no longer open.' });
  }
  expect(scene.state.planning?.planId).toBe('plan-1');
  expect(scene.state.body.getVizPanels()).toEqual([]);
});

it('refuses to start planning on a scene that has already deactivated', async () => {
  const { scene, client } = setup();
  cleanUpPreviousScene();
  cleanUpPreviousScene = () => {};
  const result = await client.execute(start);
  expect(result).toMatchObject({ success: false, error: 'The preview dashboard is no longer open.' });
  expect(scene.state.planning).toBeUndefined();
});

it('closes an open settings view when planning starts, including in the URL', async () => {
  const { scene, client } = setup();
  const editview = { getUrlKey: () => 'variables' } as unknown as DashboardEditView;
  scene.setState({ editview });
  locationService.partial({ editview: 'variables' });
  const partialSpy = jest.spyOn(locationService, 'partial');

  expect((await client.execute(start)).success).toBe(true);

  expect(scene.state.editview).toBeUndefined();
  expect(partialSpy).toHaveBeenCalledWith({ editview: null });
});

it.each(['row', 'tab'] as const)(
  'discards original %s objects after reorder without deleting a user section',
  async (kind) => {
    const { scene, client } = setup();
    await client.execute(start);
    const type = kind === 'row' ? 'ADD_ROW' : 'ADD_TAB';
    const section = { kind: kind === 'row' ? 'RowsLayoutRow' : 'TabsLayoutTab', spec: { title: 'Same title' } };
    for (let i = 0; i < 2; i++) {
      const added = await client.execute({ type, planId: 'plan-1', payload: { [kind]: section, parentPath: '/' } });
      expect(added.error).toBeUndefined();
      expect(added.success).toBe(true);
    }
    // toHaveLength + toBe rather than toEqual([user]): a live RowItem/TabItem holds a circular
    // _parent back-reference, and if this ever regresses, Jest's worker crashes trying to
    // serialize that object over IPC (JSON.stringify can't handle the cycle) instead of reporting
    // a clean assertion failure.
    if (scene.state.body instanceof RowsLayoutManager) {
      const [first, second] = scene.state.body.state.rows;
      const user = new RowItem({ title: 'Same title', layout: DefaultGridLayoutManager.fromVizPanels([]) });
      scene.state.body.setState({ rows: [second, user, first] });
      await client.execute({ type: 'END_PLANNING', payload: { planId: 'plan-1', discard: true } });
      expect(scene.state.body.state.rows).toHaveLength(1);
      expect(scene.state.body.state.rows[0]).toBe(user);
    } else if (scene.state.body instanceof TabsLayoutManager) {
      const [first, second] = scene.state.body.state.tabs;
      const user = new TabItem({ title: 'Same title', layout: DefaultGridLayoutManager.fromVizPanels([]) });
      scene.state.body.setState({ tabs: [second, user, first] });
      await client.execute({ type: 'END_PLANNING', payload: { planId: 'plan-1', discard: true } });
      expect(scene.state.body.state.tabs).toHaveLength(1);
      expect(scene.state.body.state.tabs[0]).toBe(user);
    } else {
      throw new Error('Expected section layout');
    }
  }
);

it('publishes banner actions and closes the session on deactivation', async () => {
  const { scene, client } = setup();
  const events: string[] = [];
  const subscription = appEvents.subscribe(DashboardPlanningEvent, ({ payload }) =>
    events.push(`${payload.planId}:${payload.action}`)
  );
  try {
    await client.execute(start);
    const actions = scene.state.planning!;
    actions.onBuild();
    actions.onDismiss();
    deactivatePlanningSession(scene);
    actions.onBuild();
    expect(events).toEqual(['plan-1:build', 'plan-1:dismiss', 'plan-1:closed']);
    expect(scene.state.planning).toBeUndefined();
    expect((await client.execute({ type: 'GET_LAYOUT', payload: {}, planId: 'plan-1' })).success).toBe(false);
  } finally {
    subscription.unsubscribe();
  }
});

it('preserves a replacement section and variable instead of removing them by position or name', async () => {
  const { scene, client } = setup();
  await client.execute(start);
  expect(
    (
      await client.execute({
        type: 'ADD_ROW',
        planId: 'plan-1',
        payload: { row: { kind: 'RowsLayoutRow', spec: { title: 'Original' } }, parentPath: '/' },
      })
    ).success
  ).toBe(true);
  expect(
    (
      await client.execute({
        type: 'ADD_VARIABLE',
        planId: 'plan-1',
        payload: { variable: { kind: 'CustomVariable', spec: { name: 'service', query: 'a,b' } } },
      })
    ).success
  ).toBe(true);
  const body = scene.state.body;
  if (!(body instanceof RowsLayoutManager)) {
    throw new Error('Expected rows');
  }
  const replacement = new RowItem({ title: 'Replacement', layout: DefaultGridLayoutManager.fromVizPanels([]) });
  body.setState({ rows: [replacement] });
  const variables = sceneGraph.getVariables(scene);
  const replacementVariable = new CustomVariable({ name: 'service', query: 'real' });
  variables.setState({ variables: [replacementVariable] });
  expect((await client.execute({ type: 'END_PLANNING', payload: { planId: 'plan-1', discard: true } })).success).toBe(
    true
  );
  expect(body.state.rows).toEqual([replacement]);
  expect(variables.state.variables).toEqual([replacementVariable]);
});

it('removes scaffolded variables and panels when discarded', async () => {
  const { scene, client } = setup();
  await client.execute(start);
  expect(
    (await client.execute({ type: 'ADD_PANEL', planId: 'plan-1', payload: { panel: { kind: 'Panel', spec: panel } } }))
      .success
  ).toBe(true);
  expect(
    (
      await client.execute({
        type: 'ADD_VARIABLE',
        planId: 'plan-1',
        payload: { variable: { kind: 'CustomVariable', spec: { name: 'service', query: 'a,b' } } },
      })
    ).success
  ).toBe(true);
  expect((await client.execute({ type: 'END_PLANNING', payload: { planId: 'plan-1', discard: true } })).success).toBe(
    true
  );
  expect(scene.state.body.getVizPanels()).toEqual([]);
  expect(sceneGraph.getVariables(scene).state.variables).toEqual([]);
});

it('still removes a plan panel after a layout-type conversion clones it', async () => {
  const { scene, client } = setup();
  await client.execute(start);
  expect(
    (
      await client.execute({
        type: 'ADD_ROW',
        planId: 'plan-1',
        payload: { row: { kind: 'RowsLayoutRow', spec: { title: 'Overview' } }, parentPath: '/' },
      })
    ).success
  ).toBe(true);
  expect(
    (
      await client.execute({
        type: 'ADD_PANEL',
        planId: 'plan-1',
        payload: { parentPath: '/rows/0', panel: { kind: 'Panel', spec: panel } },
      })
    ).success
  ).toBe(true);

  const body = scene.state.body;
  if (!(body instanceof RowsLayoutManager)) {
    throw new Error('Expected rows layout');
  }

  // Converting Rows -> Tabs rebuilds the tree: TabsLayoutManager.createFromLayout clones each
  // row into a new TabItem and clones the row's inner layout (and its panels) along with it, so
  // the panel tracked by ADD_PANEL above no longer resolves. The badge rescan is what still
  // finds and removes it.
  changeLayoutTo(body, TabsLayoutManager.descriptor, true);
  // Boolean comparison rather than expect(x).toBe(y): a failing toBe on two live scene objects
  // crashes Jest's worker trying to relay the circular object over IPC (see T9).
  expect(scene.state.body instanceof TabsLayoutManager).toBe(true);
  expect(scene.state.body.getVizPanels()).toHaveLength(1);

  expect((await client.execute({ type: 'END_PLANNING', payload: { planId: 'plan-1', discard: true } })).success).toBe(
    true
  );

  // toHaveLength rather than toEqual([]): a failing comparison against a live VizPanel array
  // crashes Jest's worker trying to relay the circular object over IPC (see T9).
  expect(scene.state.body.getVizPanels()).toHaveLength(0);
});

it('still removes a plan panel after it is dragged into a new row, which clones it', async () => {
  const { scene, client } = setup();
  await client.execute(start);
  expect(
    (await client.execute({ type: 'ADD_PANEL', planId: 'plan-1', payload: { panel: { kind: 'Panel', spec: panel } } }))
      .success
  ).toBe(true);
  const originalPanel = scene.state.body.getVizPanels()[0];

  const grid = scene.state.body;
  if (!(grid instanceof DefaultGridLayoutManager)) {
    throw new Error('Expected default grid layout');
  }

  // Simulates dragging the plan panel onto the "New row" drop target on the rows canvas.
  // RowsLayoutManager.draggedGridItemInside clones an AutoGridItem's panel rather than reusing
  // the tracked instance, so the badge rescan is what still finds and removes it.
  grid.removePanel(originalPanel);
  originalPanel.clearParent();
  const rowsManager = new RowsLayoutManager({ rows: [] });
  scene.setState({ body: rowsManager });
  rowsManager.draggedGridItemInside(new AutoGridItem({ body: originalPanel }));

  // Boolean comparisons rather than expect(x).toBe(y)/not.toBe(y): a failing toBe on two live
  // scene objects crashes Jest's worker trying to relay the circular object over IPC (see T9).
  expect(scene.state.body.getVizPanels()).toHaveLength(1);
  expect(scene.state.body.getVizPanels()[0] === originalPanel).toBe(false);

  expect((await client.execute({ type: 'END_PLANNING', payload: { planId: 'plan-1', discard: true } })).success).toBe(
    true
  );

  // toHaveLength rather than toEqual([]): a failing comparison against a live VizPanel array
  // crashes Jest's worker trying to relay the circular object over IPC (see T9).
  expect(scene.state.body.getVizPanels()).toHaveLength(0);
});

it('warns when a tracked section survives only because of a hollow, untracked child', async () => {
  const { scene, client } = setup();
  await client.execute(start);
  expect(
    (
      await client.execute({
        type: 'ADD_ROW',
        planId: 'plan-1',
        payload: { row: { kind: 'RowsLayoutRow', spec: { title: 'Overview' } }, parentPath: '/' },
      })
    ).success
  ).toBe(true);
  expect(
    (
      await client.execute({
        type: 'ADD_PANEL',
        planId: 'plan-1',
        payload: { parentPath: '/rows/0', panel: { kind: 'Panel', spec: panel } },
      })
    ).success
  ).toBe(true);

  const body = scene.state.body;
  if (!(body instanceof RowsLayoutManager)) {
    throw new Error('Expected rows layout');
  }
  const overview = body.state.rows[0];
  const plannedPanel = overview.state.layout.getVizPanels()[0];

  // Simulates "Group into tab" on the panel inside Overview: it moves into a brand-new
  // TabsLayoutManager/TabItem that replaces Overview's own layout. Before T6, that new tab is
  // never tracked by trackPlanningSection.
  overview.state.layout.removePanel(plannedPanel);
  const untrackedTab = new TabItem({
    title: 'New tab',
    layout: DefaultGridLayoutManager.fromVizPanels([plannedPanel]),
  });
  overview.setState({ layout: new TabsLayoutManager({ tabs: [untrackedTab] }) });

  const ended = await client.execute({ type: 'END_PLANNING', payload: { planId: 'plan-1', discard: true } });
  expect(ended.success).toBe(true);

  // T15's badge rescan still finds and removes the panel, wherever it ended up.
  expect(scene.state.body.getVizPanels()).toHaveLength(0);
  // But Overview itself survives: it looks non-empty (it still has the untracked, now-panel-less
  // "New tab" inside it) and nothing removes an untracked section. That's the known residual —
  // surfaced here as a warning rather than passing as if cleanup fully succeeded.
  expect(ended.warnings).toEqual(['Could not remove "Overview": it still contains an empty, untracked tab.']);
});

it('closes the Group-into-tab case completely once the new tab is tracked (T6)', async () => {
  const { scene, client } = setup();
  await client.execute(start);
  expect(
    (
      await client.execute({
        type: 'ADD_ROW',
        planId: 'plan-1',
        payload: { row: { kind: 'RowsLayoutRow', spec: { title: 'Overview' } }, parentPath: '/' },
      })
    ).success
  ).toBe(true);
  expect(
    (
      await client.execute({
        type: 'ADD_PANEL',
        planId: 'plan-1',
        payload: { parentPath: '/rows/0', panel: { kind: 'Panel', spec: panel } },
      })
    ).success
  ).toBe(true);

  const body = scene.state.body;
  if (!(body instanceof RowsLayoutManager)) {
    throw new Error('Expected rows layout');
  }
  const overview = body.state.rows[0];
  const plannedPanel = overview.state.layout.getVizPanels()[0];

  // Same "Group into tab" shape as the warning test above, but through the real
  // groupSelectionInto() action this time, so the new tab is tracked.
  groupSelectionInto({ source: overview.state.layout, items: [plannedPanel], target: 'tab' });

  const ended = await client.execute({ type: 'END_PLANNING', payload: { planId: 'plan-1', discard: true } });
  expect(ended.success).toBe(true);

  // No residual: the panel is gone (badge rescan), the inner tab is now tracked and empty so it
  // is removed, and removing it makes Overview itself empty too — same discard pass, since the
  // removal loop processes tracked sections depth-first (deepest first).
  expect(scene.state.body.getVizPanels()).toHaveLength(0);
  expect(ended.warnings).toBeUndefined();
  const finalBody = scene.state.body;
  const rowCount = finalBody instanceof RowsLayoutManager ? finalBody.state.rows.length : -1;
  expect(rowCount).toBe(0);
});

it('tracks and removes a row added via the "New row" action (addNewRowTo)', async () => {
  const { scene, client } = setup();
  await client.execute(start);

  // Mirrors what the sidebar's "New row" button / Add pane call directly, not through a
  // mutation command — this is the untracked-creation gap T6 closes.
  const row = addNewRowTo(scene.state.body);
  if (!(row instanceof RowItem)) {
    throw new Error('Expected a RowItem');
  }

  const ended = await client.execute({ type: 'END_PLANNING', payload: { planId: 'plan-1', discard: true } });
  expect(ended.success).toBe(true);
  expect(ended.warnings).toBeUndefined();

  const body = scene.state.body;
  const rowCount = body instanceof RowsLayoutManager ? body.state.rows.length : -1;
  expect(rowCount).toBe(0);
});

it('tracks and removes a tab added via the "New Tab" action (addNewTabTo)', async () => {
  const { scene, client } = setup();
  await client.execute(start);

  const tab = addNewTabTo(scene.state.body);
  expect(tab).toBeInstanceOf(TabItem);

  const ended = await client.execute({ type: 'END_PLANNING', payload: { planId: 'plan-1', discard: true } });
  expect(ended.success).toBe(true);
  expect(ended.warnings).toBeUndefined();

  const body = scene.state.body;
  const tabCount = body instanceof TabsLayoutManager ? body.state.tabs.length : -1;
  expect(tabCount).toBe(0);
});

it('tracks and removes a row that becomes empty after dragging a plan panel onto the rows canvas (draggedGridItemInside)', async () => {
  const { scene, client } = setup();
  await client.execute(start);
  expect(
    (await client.execute({ type: 'ADD_PANEL', planId: 'plan-1', payload: { panel: { kind: 'Panel', spec: panel } } }))
      .success
  ).toBe(true);
  const plannedPanel = scene.state.body.getVizPanels()[0];

  const grid = scene.state.body;
  if (!(grid instanceof DefaultGridLayoutManager)) {
    throw new Error('Expected default grid layout');
  }
  grid.removePanel(plannedPanel);
  plannedPanel.clearParent();

  // Dragging the plan panel onto the rows canvas: draggedGridItemInside clones it (still
  // carrying its PlanPlaceholderBadge, per T15) into a brand-new "New row". Before T6, that row
  // was never tracked, so once T15 removes the cloned panel the empty wrapper was left behind.
  const rowsManager = new RowsLayoutManager({ rows: [] });
  scene.setState({ body: rowsManager });
  rowsManager.draggedGridItemInside(new AutoGridItem({ body: plannedPanel }));
  expect(scene.state.body.getVizPanels()).toHaveLength(1);

  const ended = await client.execute({ type: 'END_PLANNING', payload: { planId: 'plan-1', discard: true } });
  expect(ended.success).toBe(true);
  expect(ended.warnings).toBeUndefined();

  expect(scene.state.body.getVizPanels()).toHaveLength(0);
  const finalBody = scene.state.body;
  const rowCount = finalBody instanceof RowsLayoutManager ? finalBody.state.rows.length : -1;
  expect(rowCount).toBe(0);
});

it('reshapes samples when visualization changes through UPDATE_PANEL', async () => {
  const { scene, client } = setup();
  await client.execute(start);
  expect(
    (await client.execute({ type: 'ADD_PANEL', planId: 'plan-1', payload: { panel: { kind: 'Panel', spec: panel } } }))
      .success
  ).toBe(true);
  const viz = scene.state.body.getVizPanels()[0];
  const updated = await client.execute({
    type: 'UPDATE_PANEL',
    planId: 'plan-1',
    payload: { element: { name: viz.state.key }, panel: { kind: 'Panel', spec: { vizConfig: { group: 'piechart' } } } },
  });
  expect(updated.error).toBeUndefined();
  expect(updated.success).toBe(true);
  expect(viz.state.pluginId).toBe('piechart');
  expect(getQueryRunnerFor(viz)).toBeUndefined();
  expect(sceneGraph.getData(viz).state.data?.series[0].fields.map((field) => field.type)).toEqual(['string', 'number']);
});

it.each(['row', 'tab'] as const)(
  'discards planning variables in an existing %s without removing same-named dashboard variables',
  async (kind) => {
    const { scene, client } = setup();
    const dashboardVariable = new CustomVariable({ name: 'service', query: 'production' });
    scene.setState({ $variables: new SceneVariableSet({ variables: [dashboardVariable] }) });
    const section =
      kind === 'row'
        ? new RowItem({ title: 'Existing', layout: DefaultGridLayoutManager.fromVizPanels([]) })
        : new TabItem({ title: 'Existing', layout: DefaultGridLayoutManager.fromVizPanels([]) });
    scene.setState({
      body:
        section instanceof RowItem
          ? new RowsLayoutManager({ rows: [section] })
          : new TabsLayoutManager({ tabs: [section] }),
    });
    await client.execute(start);

    expect(
      (
        await client.execute({
          type: 'ADD_VARIABLE',
          planId: 'plan-1',
          payload: {
            parentPath: `/${kind}s/0`,
            variable: { kind: 'CustomVariable', spec: { name: 'service', query: 'preview' } },
          },
        })
      ).success
    ).toBe(true);
    expect(section.state.$variables?.state.variables.map((variable) => variable.state.name)).toEqual(['service']);

    expect((await client.execute({ type: 'END_PLANNING', payload: { planId: 'plan-1', discard: true } })).success).toBe(
      true
    );

    expect(scene.state.$variables?.state.variables.map((variable) => variable.state.name)).toEqual(['service']);
    expect(scene.state.$variables?.state.variables[0]).toBe(dashboardVariable);
    expect(section.getRoot()).toBe(scene);
    expect(section.state.$variables).toBeUndefined();
  }
);

it.each([
  { layout: 'grid', discard: true },
  { layout: 'auto-grid', discard: true },
  { layout: 'grid', discard: false },
  { layout: 'auto-grid', discard: false },
])('handles UI-created and duplicated $layout placeholders with discard=$discard', async ({ layout, discard }) => {
  const { scene, client } = setup();
  const existing = new VizPanel({ title: 'Existing', pluginId: 'text', key: 'panel-1' });
  const grid =
    layout === 'grid'
      ? DefaultGridLayoutManager.fromVizPanels([existing])
      : new AutoGridLayoutManager({ layout: new AutoGridLayout({ children: [new AutoGridItem({ body: existing })] }) });
  const row = new RowItem({ title: 'Existing row', layout: grid });
  scene.setState({ body: new RowsLayoutManager({ rows: [row] }) });
  await client.execute(start);

  // Moving an existing real panel also inserts a clone through addPanel.
  const movedExisting = existing.clone();
  grid.removePanel(existing);
  grid.addPanel(movedExisting);

  // The sidebar and drag/drop insert into the selected layout, bypassing ADD_PANEL.
  const added = await getDefaultVizPanel(scene);
  grid.addPanel(added);
  scene.duplicatePanel(added);
  const before = grid.getVizPanels();
  expect(before.map((panel) => panel.state.title)).toEqual(['Existing', 'New panel', 'New panel']);
  expect(before.slice(1).map((panel) => getQueryRunnerFor(panel))).toEqual([undefined, undefined]);

  expect((await client.execute({ type: 'END_PLANNING', payload: { planId: 'plan-1', discard } })).success).toBe(true);

  expect(grid.getVizPanels().map((panel) => panel.state.title)).toEqual(
    discard ? ['Existing'] : ['Existing', 'New panel', 'New panel']
  );
  expect(grid.getVizPanels()[0]).toBe(movedExisting);
  expect(row.getRoot()).toBe(scene);
});

it.each(['row', 'tab'] as const)(
  'preserves existing panels wrapped in a new %s when discarding a plan',
  async (kind) => {
    const { scene, client } = setup();
    const existing = new VizPanel({ title: 'Existing panel', pluginId: 'text', key: 'panel-1' });
    const originalLayout = DefaultGridLayoutManager.fromVizPanels([existing]);
    scene.setState({ body: originalLayout });
    await client.execute(start);
    expect(
      (
        await client.execute({
          type: kind === 'row' ? 'ADD_ROW' : 'ADD_TAB',
          planId: 'plan-1',
          payload: {
            parentPath: '/',
            [kind]: { kind: kind === 'row' ? 'RowsLayoutRow' : 'TabsLayoutTab', spec: { title: 'Plan wrapper' } },
          },
        })
      ).success
    ).toBe(true);
    expect(
      (
        await client.execute({
          type: 'ADD_PANEL',
          planId: 'plan-1',
          payload: { parentPath: `/${kind}s/0`, panel: { kind: 'Panel', spec: panel } },
        })
      ).success
    ).toBe(true);
    expect(scene.state.body.getVizPanels().map((panel) => panel.state.title)).toEqual(['Existing panel', 'CPU usage']);

    expect((await client.execute({ type: 'END_PLANNING', payload: { planId: 'plan-1', discard: true } })).success).toBe(
      true
    );

    expect(scene.state.body.getVizPanels().map((panel) => panel.state.title)).toEqual(['Existing panel']);
    expect(scene.state.body.getVizPanels()[0]).toBe(existing);
    expect(originalLayout.getRoot()).toBe(scene);
    expect(scene.isPlanning()).toBe(false);
  }
);

it.each(['row', 'tab'] as const)(
  'keeps a %s wrapping pre-existing content but removes an empty plan-only sibling on discard',
  async (kind) => {
    // Planning is not empty-dashboard-only: ADD_ROW/ADD_TAB wrap non-empty content instead of
    // replacing it (see trackPlanningSection's doc comment). This is why tracking a section is not
    // enough on its own — endPlanningSession also has to check emptiness before removing a tracked
    // section, or it would delete the real content this test wraps.
    const { scene, client } = setup();
    const existing = new VizPanel({ title: 'Existing panel', pluginId: 'text', key: 'panel-1' });
    scene.setState({ body: DefaultGridLayoutManager.fromVizPanels([existing]) });
    await client.execute(start);

    // Wraps the existing panel: tracked, but never empty, so it must survive discard.
    const wrapType = kind === 'row' ? 'ADD_ROW' : 'ADD_TAB';
    expect(
      (
        await client.execute({
          type: wrapType,
          planId: 'plan-1',
          payload: {
            parentPath: '/',
            [kind]: { kind: kind === 'row' ? 'RowsLayoutRow' : 'TabsLayoutTab', spec: { title: 'Wraps existing' } },
          },
        })
      ).success
    ).toBe(true);

    // A second, plan-only section with nothing in it: tracked, and empty, so it must be removed.
    expect(
      (
        await client.execute({
          type: wrapType,
          planId: 'plan-1',
          payload: {
            parentPath: '/',
            [kind]: { kind: kind === 'row' ? 'RowsLayoutRow' : 'TabsLayoutTab', spec: { title: 'Plan-only' } },
          },
        })
      ).success
    ).toBe(true);

    const ended = await client.execute({ type: 'END_PLANNING', payload: { planId: 'plan-1', discard: true } });
    expect(ended.success).toBe(true);
    // No false positive: "Wraps existing" survives because of real content, not a hollow,
    // untracked child, so this must not produce a T16 warning.
    expect(ended.warnings).toBeUndefined();

    const body = scene.state.body;
    const titles =
      body instanceof RowsLayoutManager
        ? body.state.rows.map((row) => row.state.title)
        : body instanceof TabsLayoutManager
          ? body.state.tabs.map((tab) => tab.state.title)
          : [];
    expect(titles).toEqual(['Wraps existing']);
    // toHaveLength + toBe rather than toEqual([existing]): see the comment on the assertions above
    // in "discards original %s objects after reorder..." for why toEqual on a live scene object is
    // worth avoiding here.
    expect(scene.state.body.getVizPanels()).toHaveLength(1);
    expect(scene.state.body.getVizPanels()[0]).toBe(existing);
  }
);

it('preserves an existing empty section and its variables inside a planning wrapper', async () => {
  const { scene, client } = setup();
  const variable = new CustomVariable({ name: 'service', query: 'production' });
  const row = new RowItem({
    title: 'Existing empty row',
    layout: DefaultGridLayoutManager.fromVizPanels([]),
    $variables: new SceneVariableSet({ variables: [variable] }),
  });
  scene.setState({ body: new RowsLayoutManager({ rows: [row] }) });
  await client.execute(start);
  expect(
    (
      await client.execute({
        type: 'ADD_TAB',
        planId: 'plan-1',
        payload: { parentPath: '/', tab: { kind: 'TabsLayoutTab', spec: { title: 'Plan wrapper' } } },
      })
    ).success
  ).toBe(true);

  expect((await client.execute({ type: 'END_PLANNING', payload: { planId: 'plan-1', discard: true } })).success).toBe(
    true
  );

  expect(row.getRoot() === scene).toBe(true);
  expect(row.state.$variables?.state.variables[0]).toBe(variable);
});

it('removes empty planning sections before wrappers created after them', async () => {
  const { scene, client } = setup();
  await client.execute(start);
  expect(
    (
      await client.execute({
        type: 'ADD_ROW',
        planId: 'plan-1',
        payload: { parentPath: '/', row: { kind: 'RowsLayoutRow', spec: { title: 'Plan row' } } },
      })
    ).success
  ).toBe(true);
  expect(
    (
      await client.execute({
        type: 'ADD_TAB',
        planId: 'plan-1',
        payload: { parentPath: '/', tab: { kind: 'TabsLayoutTab', spec: { title: 'Plan wrapper' } } },
      })
    ).success
  ).toBe(true);

  expect((await client.execute({ type: 'END_PLANNING', payload: { planId: 'plan-1', discard: true } })).success).toBe(
    true
  );

  const body = scene.state.body;
  if (!(body instanceof TabsLayoutManager)) {
    throw new Error('Expected tabs layout');
  }
  // toHaveLength rather than toEqual([]): a live TabItem holds a circular _parent back-reference,
  // and if this ever regresses, Jest's worker crashes trying to serialize that object over IPC
  // (JSON.stringify can't handle the cycle) instead of reporting a clean assertion failure.
  expect(body.state.tabs).toHaveLength(0);
});

it.each([
  { layout: 'grid', realQueries: false },
  { layout: 'grid', realQueries: true },
  { layout: 'auto-grid', realQueries: false },
  { layout: 'auto-grid', realQueries: true },
])(
  'preserves a kept $layout placeholder during a later plan with realQueries=$realQueries',
  async ({ layout, realQueries }) => {
    const { scene, client } = setup();
    const grid = layout === 'grid' ? DefaultGridLayoutManager.fromVizPanels([]) : new AutoGridLayoutManager({});
    scene.setState({ body: grid });
    await client.execute(start);
    expect(
      (
        await client.execute({
          type: 'ADD_PANEL',
          planId: 'plan-1',
          payload: { panel: { kind: 'Panel', spec: panel } },
        })
      ).success
    ).toBe(true);
    const kept = grid.getVizPanels()[0];
    expect(
      (await client.execute({ type: 'END_PLANNING', payload: { planId: 'plan-1', discard: false } })).success
    ).toBe(true);
    if (realQueries) {
      kept.setState({ $data: new SceneQueryRunner({ queries: [{ refId: 'A' }] }) });
    }
    expect(kept.state.titleItems?.some((item) => item instanceof PlanPlaceholderBadge)).toBe(true);

    await client.execute({
      type: 'START_PLANNING',
      payload: { planId: 'plan-2', planTitle: 'Next plan', panelCount: 1 },
    });
    // MOVE_PANEL removes the original and adds a clone, retaining its title items.
    const moved = kept.clone();
    grid.removePanel(kept);
    grid.addPanel(moved);
    const newPlaceholder = await getDefaultVizPanel(scene);
    grid.addPanel(newPlaceholder);
    scene.duplicatePanel(newPlaceholder);
    expect(grid.getVizPanels().map((panel) => panel.state.title)).toEqual(['CPU usage', 'New panel', 'New panel']);

    expect((await client.execute({ type: 'END_PLANNING', payload: { planId: 'plan-2', discard: true } })).success).toBe(
      true
    );

    expect(grid.getVizPanels().map((panel) => panel.state.title)).toEqual(['CPU usage']);
    expect(grid.getVizPanels()[0]).toBe(moved);
    expect(Boolean(getQueryRunnerFor(moved))).toBe(realQueries);
  }
);
