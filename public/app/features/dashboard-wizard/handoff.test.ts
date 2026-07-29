import { createAssistantContextItem, openAssistant } from '@grafana/assistant';
import { locationService } from '@grafana/runtime';

import { buildPlanningInstructions, startPlanningInAssistant } from './handoff';
import { WIZARD_ORIGIN } from './prompts';

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
  locationService: { push: jest.fn() },
}));

const openAssistantMock = jest.mocked(openAssistant);
const pushMock = jest.mocked(locationService.push);

const args = {
  request: 'Monitor my checkout service\n\nWhere this request came from:\nPrometheus datasource page',
  displayPrompt: 'Monitor my checkout service',
  contextItems: [createAssistantContextItem('structured', { title: 'Attached item', data: { foo: 'bar' } })],
  datasources: [{ uid: 'prom-1', type: 'prometheus', name: 'Prometheus' }],
};

describe('startPlanningInAssistant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lands in the new-dashboard editor and opens a dashboarding conversation', () => {
    startPlanningInAssistant(args);

    expect(pushMock).toHaveBeenCalledWith('/dashboard/new');
    expect(openAssistantMock).toHaveBeenCalledTimes(1);

    const call = openAssistantMock.mock.calls[0][0];
    expect(call.origin).toBe(WIZARD_ORIGIN);
    expect(call.mode).toBe('dashboarding');
    expect(call.autoSend).toBe(true);
    // The chat shows the user's own words, not the composed request.
    expect(call.prompt).toBe('Monitor my checkout service');
  });

  it('passes the picker items through and appends a hidden planning-instructions item', () => {
    startPlanningInAssistant(args);

    const call = openAssistantMock.mock.calls[0][0];
    expect(call.context).toHaveLength(2);
    expect(call.context?.[0]).toBe(args.contextItems[0]);

    const planningItem = call.context?.[1];
    // The exact title is the trigger the assistant's plan-first workflow matches on.
    expect(planningItem?.node.name).toBe('Dashboard planning instructions');
    expect(planningItem?.node.data?.params?.hidden).toBe(true);
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
});
