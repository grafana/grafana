import { openAssistant } from '@grafana/assistant';
import { locationService } from '@grafana/runtime';

import { buildPlanningInstructions, startPlanningInAssistant } from './handoff';
import { PROMPT_ORIGIN, MAX_LISTED_DATASOURCES } from './prompts';

// The repo-wide jest mapping stubs @grafana/assistant with no-op fns, so give
// createAssistantContextItem a fake that mirrors the real factory's shape.
jest.mock('@grafana/assistant', () => ({
  ...jest.requireActual('@grafana/assistant'),
  openAssistant: jest.fn(),
  createAssistantContextItem: jest.fn((type: string, params: Record<string, unknown>) => ({
    node: {
      id: String(params.title ?? type),
      name: params.title,
      navigable: false,
      selectable: true,
      data: { type, params },
    },
    occurrences: [],
  })),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: { push: jest.fn(), getLocation: jest.fn() },
}));

const openAssistantMock = jest.mocked(openAssistant);
const pushMock = jest.mocked(locationService.push);
const getLocationMock = jest.mocked(locationService.getLocation);

/** Navigation succeeded: we're on the new-dashboard editor afterwards. */
function landedOnNewDashboard() {
  getLocationMock.mockReturnValue({ pathname: '/dashboard/new' } as ReturnType<typeof locationService.getLocation>);
}

/** Navigation was refused, e.g. by the unsaved-changes blocker. */
function stayedPut() {
  getLocationMock.mockReturnValue({ pathname: '/d/abc/my-dashboard' } as ReturnType<
    typeof locationService.getLocation
  >);
}

const args = {
  request: 'Monitor my checkout service\n\nWhere this request came from:\nPrometheus datasource page',
  displayPrompt: 'Monitor my checkout service',
  datasources: [{ uid: 'prom-1', type: 'prometheus', name: 'Prometheus' }],
};

describe('startPlanningInAssistant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    landedOnNewDashboard();
  });

  it('lands in the new-dashboard editor and opens a dashboarding conversation', () => {
    expect(startPlanningInAssistant(args)).toBe(true);

    expect(pushMock).toHaveBeenCalledWith('/dashboard/new');
    expect(openAssistantMock).toHaveBeenCalledTimes(1);

    const call = openAssistantMock.mock.calls[0][0];
    expect(call.origin).toBe(PROMPT_ORIGIN);
    expect(call.mode).toBe('dashboarding');
    expect(call.autoSend).toBe(true);
    // The chat shows the user's own words, not the composed request.
    expect(call.prompt).toBe('Monitor my checkout service');
  });

  it('attaches a hidden planning-instructions item', () => {
    startPlanningInAssistant(args);

    const call = openAssistantMock.mock.calls[0][0];
    expect(call.context).toHaveLength(1);

    const planningItem = call.context?.[0];
    // The exact title is the trigger the assistant's plan-first workflow matches on.
    expect(planningItem?.node.name).toBe('Dashboard planning instructions');
    expect(planningItem?.node.data?.params?.hidden).toBe(true);
  });
});

describe('startPlanningInAssistant when navigation is refused', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stayedPut();
  });

  it('starts nothing, so the assistant is never pointed at the wrong dashboard', () => {
    expect(startPlanningInAssistant(args)).toBe(false);

    // The push was attempted; the blocker swallowed it.
    expect(pushMock).toHaveBeenCalledWith('/dashboard/new');
    expect(openAssistantMock).not.toHaveBeenCalled();
  });
});

describe('startPlanningInAssistant folder handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    landedOnNewDashboard();
  });

  it('creates the draft in the folder the entry point knew about', () => {
    startPlanningInAssistant({ ...args, folderUid: 'folder-1' });
    expect(pushMock).toHaveBeenCalledWith('/dashboard/new?folderUid=folder-1');
  });

  it('escapes the folder uid', () => {
    startPlanningInAssistant({ ...args, folderUid: 'a b/c&d' });
    expect(pushMock).toHaveBeenCalledWith('/dashboard/new?folderUid=a%20b%2Fc%26d');
  });

  it('goes to the bare new-dashboard path when no folder is known', () => {
    startPlanningInAssistant(args);
    expect(pushMock).toHaveBeenCalledWith('/dashboard/new');
  });
});

describe('buildPlanningInstructions', () => {
  it('carries the full request, the datasource scope, and the plan-first framing', () => {
    const instructions = buildPlanningInstructions(args);

    expect(instructions).toContain('plan-first workflow');
    expect(instructions).toContain('propose_dashboard_plan');
    expect(instructions).toContain('Monitor my checkout service');
    expect(instructions).toContain('Where this request came from');
    expect(instructions).toContain('Prometheus (type: prometheus, uid: prom-1)');
    expect(instructions).toContain('no others exist');
    expect(instructions).toContain('Do NOT save the dashboard');
  });

  it('does not claim completeness when the datasource scope is truncated', () => {
    const manyDatasources = Array.from({ length: MAX_LISTED_DATASOURCES + 10 }, (_, i) => ({
      uid: `ds-${i}`,
      type: 'prometheus',
      name: `Datasource ${i}`,
    }));

    const instructions = buildPlanningInstructions({ ...args, datasources: manyDatasources });

    expect(instructions).not.toContain('no others exist');
    expect(instructions).toContain('this instance has 60');
    expect(instructions).toContain('datasource discovery tool');
    // The listed uids are still exact and queryable.
    expect(instructions).toContain('uid: ds-0');
    expect(instructions).toContain(`…and 10 more not shown here`);
  });
});
