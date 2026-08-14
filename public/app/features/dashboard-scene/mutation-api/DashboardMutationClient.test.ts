import { config } from '@grafana/runtime';

import type { DashboardScene } from '../scene/DashboardScene';

import { DashboardMutationClient } from './DashboardMutationClient';

function createClient(canEditDashboard: boolean): DashboardMutationClient {
  // canEditDashboard is the only scene member the permission checks read.
  return new DashboardMutationClient({ canEditDashboard: () => canEditDashboard } as unknown as DashboardScene);
}

describe('DashboardMutationClient.getAvailableCommands', () => {
  let originalNewLayouts: boolean | undefined;

  beforeEach(() => {
    originalNewLayouts = config.featureToggles.dashboardNewLayouts;
    config.featureToggles.dashboardNewLayouts = true;
  });

  afterEach(() => {
    config.featureToggles.dashboardNewLayouts = originalNewLayouts;
  });

  it('lists the write commands on an editable dashboard', () => {
    expect(createClient(true).getAvailableCommands()).toEqual(expect.arrayContaining(['ADD_PANEL', 'ADD_ROW']));
  });

  // A read-only dashboard, Grafana Home being the one users hit, used to
  // advertise the full registry.
  it('omits write commands on a dashboard that cannot be edited, and keeps reads', () => {
    const commands = createClient(false).getAvailableCommands();

    expect(commands).not.toContain('ADD_PANEL');
    expect(commands).toContain('LIST_PANELS');
  });

  it('omits commands behind a disabled feature toggle', () => {
    config.featureToggles.dashboardNewLayouts = false;

    const commands = createClient(true).getAvailableCommands();

    expect(commands).not.toContain('ADD_ROW');
    expect(commands).toContain('ADD_PANEL');
  });
});

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
