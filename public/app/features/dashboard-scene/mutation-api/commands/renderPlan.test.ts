import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { getQueryRunnerFor } from '../../utils/getQueryRunnerFor';
import { DashboardMutationClient } from '../DashboardMutationClient';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({ id })),
  getPanelPluginFromCache: (id: string) => getPanelPlugin({ id }),
});

let cleanUpPreviousScene = () => {};

function setup() {
  cleanUpPreviousScene();
  const scene = new DashboardScene({ title: 'hello', meta: { canEdit: true } });
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

  it('renders stand-in variables alongside the plan', async () => {
    const { scene, client } = setup();

    await client.execute({
      type: 'RENDER_PLAN',
      payload: { ...plan, variables: [{ name: 'env', query: 'prod,staging' }] },
    });

    expect(scene.state.$variables?.state.variables.map((v) => v.state.name)).toEqual(['env']);
  });

  it('refuses when the scene is no longer open', async () => {
    const { scene, client } = setup();
    cleanUpPreviousScene();
    cleanUpPreviousScene = () => {};

    const result = await client.execute({ type: 'RENDER_PLAN', payload: plan });

    expect(result).toMatchObject({ success: false, error: 'The preview dashboard is no longer open.' });
    expect(scene.state.planning).toBeUndefined();
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
});
