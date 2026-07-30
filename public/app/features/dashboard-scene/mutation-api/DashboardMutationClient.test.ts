import { config } from '@grafana/runtime';

import type { DashboardScene } from '../scene/DashboardScene';

import { DashboardMutationClient } from './DashboardMutationClient';

function createClient(canEditDashboard: boolean): DashboardMutationClient {
  // canEditDashboard is the only scene member the permission checks read.
  return new DashboardMutationClient({ canEditDashboard: () => canEditDashboard } as unknown as DashboardScene);
}

describe('DashboardMutationClient.canExecute', () => {
  let originalNewLayouts: boolean | undefined;

  beforeEach(() => {
    originalNewLayouts = config.featureToggles.dashboardNewLayouts;
    config.featureToggles.dashboardNewLayouts = true;
  });

  afterEach(() => {
    config.featureToggles.dashboardNewLayouts = originalNewLayouts;
  });

  it('allows commands the current dashboard permits', () => {
    expect(createClient(true).canExecute(['ADD_PANEL', 'REMOVE_PANEL'])).toEqual({ allowed: true });
  });

  it('matches command names case-insensitively', () => {
    expect(createClient(true).canExecute(['add_panel'])).toEqual({ allowed: true });
  });

  it('names the command and the reason when the dashboard cannot be edited', () => {
    expect(createClient(false).canExecute(['ADD_PANEL'])).toEqual({
      allowed: false,
      blocked: [{ command: 'ADD_PANEL', reason: expect.stringContaining('insufficient permissions') }],
    });
  });

  // The gap a command list cannot express: layout commands are registered
  // whatever the toggle says, and refused when it is off.
  it('reports the feature toggle a command is waiting on', () => {
    config.featureToggles.dashboardNewLayouts = false;

    expect(createClient(true).canExecute(['ADD_ROW'])).toEqual({
      allowed: false,
      blocked: [{ command: 'ADD_ROW', reason: expect.stringContaining('dashboardNewLayouts') }],
    });
  });

  it('reports a command this version does not implement', () => {
    expect(createClient(true).canExecute(['TELEPORT_PANEL'])).toEqual({
      allowed: false,
      blocked: [{ command: 'TELEPORT_PANEL', reason: 'Unknown command type: TELEPORT_PANEL' }],
    });
  });

  // Reporting only the first would make a caller fix one thing, retry, and
  // discover the next.
  it('reports every blocked command, not just the first', () => {
    config.featureToggles.dashboardNewLayouts = false;

    const permission = createClient(true).canExecute(['ADD_ROW', 'ADD_PANEL', 'TELEPORT_PANEL']);

    expect(permission).toEqual({
      allowed: false,
      blocked: [
        { command: 'ADD_ROW', reason: expect.stringContaining('dashboardNewLayouts') },
        { command: 'TELEPORT_PANEL', reason: 'Unknown command type: TELEPORT_PANEL' },
      ],
    });
  });

  it('allows an empty list', () => {
    expect(createClient(false).canExecute([])).toEqual({ allowed: true });
  });
});
