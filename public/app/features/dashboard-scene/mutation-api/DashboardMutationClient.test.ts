import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { DashboardMutationClient } from './DashboardMutationClient';
import { DASHBOARD_COMMANDS } from './commands/registry';

function dashboardScene(): DashboardScene {
  return new DashboardScene({
    title: 'Dash',
    uid: 'dash-1',
    meta: { canEdit: true },
    body: DefaultGridLayoutManager.fromVizPanels([]),
  });
}

describe('DashboardMutationClient', () => {
  it('exposes every dashboard command', () => {
    const available = new Set(new DashboardMutationClient(dashboardScene()).getAvailableCommands());

    for (const cmd of DASHBOARD_COMMANDS) {
      expect(available.has(cmd.name)).toBe(true);
    }
  });

  it('names the available commands when asked for one that is not here', async () => {
    const client = new DashboardMutationClient(dashboardScene());

    const result = await client.execute({ type: 'NOT_A_COMMAND', payload: {} });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown command type: NOT_A_COMMAND');
    expect(result.error).toContain('GET_SPEC');
  });
});
