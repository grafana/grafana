import { SceneTimeRange, SceneVariableSet } from '@grafana/scenes';
import { dashboardMutationApi } from 'app/features/plugins/components/restrictedGrafanaApis/dashboardMutation/dashboardMutationApi';
import {
  getDashboardMutationClient,
  setDashboardMutationClient,
} from 'app/features/plugins/components/restrictedGrafanaApis/dashboardMutation/dashboardMutationStore';

import { DashboardScene } from '../scene/DashboardScene';

import { DashboardMutationBehavior } from './DashboardMutationBehavior';

function buildAndActivateScene(): { scene: DashboardScene; deactivate: () => void } {
  const scene = new DashboardScene({
    title: 'Test Dashboard',
    uid: 'test-uid',
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    $variables: new SceneVariableSet({ variables: [] }),
    $behaviors: [new DashboardMutationBehavior()],
  });
  const deactivate = scene.activate();
  return { scene, deactivate };
}

describe('DashboardMutationBehavior', () => {
  afterEach(() => {
    setDashboardMutationClient(null);
  });

  it('registers the mutation client on activation', () => {
    const { deactivate } = buildAndActivateScene();

    expect(getDashboardMutationClient()).not.toBeNull();

    deactivate();
  });

  it('unregisters the mutation client on deactivation', () => {
    const { deactivate } = buildAndActivateScene();
    expect(getDashboardMutationClient()).not.toBeNull();

    deactivate();
    expect(getDashboardMutationClient()).toBeNull();
  });

  it('executes commands through the registered client', async () => {
    const { deactivate } = buildAndActivateScene();

    const client = getDashboardMutationClient();
    expect(client).not.toBeNull();

    const result = await client!.execute({ type: 'LIST_VARIABLES', payload: {} });
    expect(result.success).toBe(true);

    deactivate();
  });

  it('restricted API delegates to the registered client', async () => {
    const { deactivate } = buildAndActivateScene();

    const result = await dashboardMutationApi.execute({ type: 'LIST_VARIABLES', payload: {} });
    expect(result.success).toBe(true);

    deactivate();
  });

  it('restricted API rejects when no scene is active', async () => {
    await expect(dashboardMutationApi.execute({ type: 'LIST_VARIABLES', payload: {} })).rejects.toThrow(
      'Dashboard Mutation API is not available'
    );
  });

  describe('security: behavior does not expose execute()', () => {
    it('the behavior object on $behaviors has no execute method', () => {
      const { scene, deactivate } = buildAndActivateScene();

      const behaviors = scene.state.$behaviors ?? [];
      const mutationBehavior = behaviors.find((b) => b instanceof DashboardMutationBehavior);
      expect(mutationBehavior).toBeDefined();
      expect(typeof (mutationBehavior as Record<string, unknown>).execute).toBe('undefined');

      deactivate();
    });
  });
});
