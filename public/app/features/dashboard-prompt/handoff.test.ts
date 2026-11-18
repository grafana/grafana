import { type ChatContextItem, openAssistant } from '@grafana/assistant';

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

const openAssistantMock = jest.mocked(openAssistant);

const args = {
  request: 'Monitor my checkout service\n\nWhere this request came from:\nPrometheus datasource page',
  displayPrompt: 'Monitor my checkout service',
  datasources: [{ uid: 'prom-1', type: 'prometheus', name: 'Prometheus' }],
};

describe('startPlanningInAssistant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens a dashboarding conversation', () => {
    startPlanningInAssistant(args);

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
  it('preserves selected context objects alongside the hidden planning instructions', () => {
    const contextItems: ChatContextItem[] = [
      {
        node: {
          id: 'prom-1',
          name: 'Prometheus',
          navigable: false,
          img: '/prometheus.svg',
          data: { type: 'datasource', datasourceUid: 'prom-1', formatForLLM: () => 'Datasource context' },
        },
        occurrences: ['mention-1'],
      },
      {
        node: {
          id: 'dashboards/dash-1',
          name: 'Checkout',
          navigable: false,
          data: { type: 'dashboard', dashboardUid: 'dash-1', folderUid: 'folder-2', folderTitle: 'Payments' },
        },
        occurrences: [],
      },
    ];
    startPlanningInAssistant({ ...args, context: contextItems });

    const context = openAssistantMock.mock.calls[0][0].context;
    expect(context).toHaveLength(3);
    expect(context?.[0].node.name).toBe('Dashboard planning instructions');
    expect(context?.[1]).toBe(contextItems[0]);
    expect(context?.[2]).toBe(contextItems[1]);
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
    expect(instructions).toContain('starting from a brand-new dashboard');
  });

  it('lists attached dashboards', () => {
    const instructions = buildPlanningInstructions({
      ...args,
      dashboards: [{ uid: 'dash-1', title: 'Checkout' }],
    });

    expect(instructions).toContain('Dashboards the user attached as context');
    expect(instructions).toContain('Checkout (uid: dash-1)');
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
