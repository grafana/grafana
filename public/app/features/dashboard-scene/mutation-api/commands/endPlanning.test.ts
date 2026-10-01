import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';

import { DashboardScene } from '../../scene/DashboardScene';
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
  sections: [{ title: 'Throughput', panels: [{ title: 'Requests', vizType: 'timeseries' }] }],
};

describe('END_PLANNING', () => {
  it('clears the dashboard back to empty, unconditionally -- no scaffold to keep', async () => {
    const { scene, client } = setup();
    await client.execute({ type: 'RENDER_PLAN', payload: plan });
    expect(scene.state.body.getVizPanels()).toHaveLength(1);

    const result = await client.execute({ type: 'END_PLANNING', payload: { planId: 'plan-1' } });

    expect(result.success).toBe(true);
    expect(scene.state.body.getVizPanels()).toHaveLength(0);
    expect(scene.state.planning).toBeUndefined();
    expect(scene.state.$variables?.state.variables).toEqual([]);
  });

  it('refuses a stale planId, against a plan that has already been superseded', async () => {
    const { scene, client } = setup();
    await client.execute({ type: 'RENDER_PLAN', payload: plan });
    await client.execute({ type: 'RENDER_PLAN', payload: { ...plan, planId: 'plan-2', title: 'Replacement' } });

    const result = await client.execute({ type: 'END_PLANNING', payload: { planId: 'plan-1' } });

    expect(result).toMatchObject({ success: false, error: 'The preview dashboard is no longer open.' });
    expect(scene.state.planning?.planId).toBe('plan-2');
  });

  it('refuses when nothing is being previewed', async () => {
    const { client } = setup();

    const result = await client.execute({ type: 'END_PLANNING', payload: { planId: 'plan-1' } });

    expect(result.success).toBe(false);
  });
});
