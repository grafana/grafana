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

  it('also exposes CREATE_NOTEBOOK_SPEC', () => {
    const available = new DashboardMutationClient(dashboardScene()).getAvailableCommands();

    // Creating a notebook reads nothing off the open document and there is no blank notebook to open
    // first, so it has to be reachable from where the user already is — a dashboard.
    expect(available).toContain('CREATE_NOTEBOOK_SPEC');
  });

  it('exposes no other notebook command', () => {
    const available = new DashboardMutationClient(dashboardScene()).getAvailableCommands();

    // GET/APPLY_NOTEBOOK_SPEC need an open notebook, so a dashboard must not be able to reach them.
    expect(available).not.toContain('GET_NOTEBOOK_SPEC');
    expect(available).not.toContain('APPLY_NOTEBOOK_SPEC');
  });

  it('names the available commands when asked for one that is not here', async () => {
    const client = new DashboardMutationClient(dashboardScene());

    const result = await client.execute({ type: 'GET_NOTEBOOK_SPEC', payload: {} });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown command type: GET_NOTEBOOK_SPEC');
    expect(result.error).toContain('GET_SPEC');
  });
});
