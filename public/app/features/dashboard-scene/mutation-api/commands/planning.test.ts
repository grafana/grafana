import { getPanelPlugin } from '@grafana/data/test';
import { config, setPluginImportUtils } from '@grafana/runtime';
import { CustomVariable, sceneGraph, SceneVariableSet } from '@grafana/scenes';
import { appEvents } from 'app/core/app_events';

import { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { DashboardPlanningEvent } from '../../scene/planningEvents';
import { deactivatePlanningSession } from '../../scene/planningSession';
import { getQueryRunnerFor } from '../../utils/getQueryRunnerFor';
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

function setup() {
  const scene = new DashboardScene({
    title: 'Preview',
    isEditing: true,
    meta: { canEdit: true },
    body: DefaultGridLayoutManager.fromVizPanels([]),
    $variables: new SceneVariableSet({ variables: [] }),
  });
  jest.spyOn(scene, 'activateSidebar').mockImplementation(() => {});
  jest.spyOn(scene, 'forceRender').mockImplementation(() => {});
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
    if (scene.state.body instanceof RowsLayoutManager) {
      const [first, second] = scene.state.body.state.rows;
      const user = new RowItem({ title: 'Same title', layout: DefaultGridLayoutManager.fromVizPanels([]) });
      scene.state.body.setState({ rows: [second, user, first] });
      await client.execute({ type: 'END_PLANNING', payload: { planId: 'plan-1', discard: true } });
      expect(scene.state.body.state.rows).toEqual([user]);
    } else if (scene.state.body instanceof TabsLayoutManager) {
      const [first, second] = scene.state.body.state.tabs;
      const user = new TabItem({ title: 'Same title', layout: DefaultGridLayoutManager.fromVizPanels([]) });
      scene.state.body.setState({ tabs: [second, user, first] });
      await client.execute({ type: 'END_PLANNING', payload: { planId: 'plan-1', discard: true } });
      expect(scene.state.body.state.tabs).toEqual([user]);
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
