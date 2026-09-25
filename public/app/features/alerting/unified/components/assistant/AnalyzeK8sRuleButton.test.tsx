import { render, screen, userEvent } from 'test/test-utils';

import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { useAssistant } from '@grafana/assistant';
import { Menu } from '@grafana/ui';

import { AnalyzeK8sRuleButton } from './AnalyzeK8sRuleButton';

const mockOpenAssistant = jest.fn();
jest.mock('@grafana/assistant', () => ({
  useAssistant: jest.fn(),
  createAssistantContextItem: jest.fn(<T extends object>(type: string, data: T) => ({
    type,
    ...data,
  })),
}));
const mockUseAssistant = jest.mocked(useAssistant);

const alertRule: AlertRule = {
  apiVersion: 'v0alpha1',
  kind: 'AlertRule',
  metadata: { name: 'alert-rule-uid' },
  spec: {
    title: 'High CPU usage',
    labels: { severity: 'critical', team: 'infra' },
    annotations: { summary: 'CPU usage is too high' },
    expressions: { A: { model: { expr: 'cpu_usage > 90' }, source: true } },
    execErrState: 'Alerting',
    noDataState: 'NoData',
    trigger: { interval: '1m' },
  },
} as AlertRule;

const recordingRule: RecordingRule = {
  apiVersion: 'v0alpha1',
  kind: 'RecordingRule',
  metadata: { name: 'recording-rule-uid' },
  spec: {
    title: 'CPU usage average',
    labels: { team: 'infra' },
    expressions: { A: { model: { expr: 'avg(cpu_usage)' }, source: true } },
    metric: 'cpu_usage:avg',
    targetDatasourceUID: 'prometheus-uid',
    trigger: { interval: '1m' },
  },
} as RecordingRule;

function renderAnalyzeButton(props: Parameters<typeof AnalyzeK8sRuleButton>[0]) {
  return render(
    <Menu>
      <AnalyzeK8sRuleButton {...props} />
    </Menu>
  );
}

describe('AnalyzeK8sRuleButton', () => {
  beforeEach(() => {
    mockOpenAssistant.mockClear();
    mockUseAssistant.mockReturnValue({
      isLoading: false,
      isAvailable: true,
      openAssistant: mockOpenAssistant,
    } as unknown as ReturnType<typeof useAssistant>);
  });

  it('renders nothing when the Assistant is unavailable', () => {
    mockUseAssistant.mockReturnValue({
      isLoading: false,
      isAvailable: false,
      openAssistant: mockOpenAssistant,
    } as unknown as ReturnType<typeof useAssistant>);

    renderAnalyzeButton({ kind: 'alert', rule: alertRule });

    expect(screen.queryByRole('menuitem', { name: /analyze rule/i })).not.toBeInTheDocument();
  });

  it('opens the Assistant with structured context mapped from an AlertRule resource', async () => {
    const user = userEvent.setup();
    renderAnalyzeButton({ kind: 'alert', rule: alertRule });

    await user.click(screen.getByRole('menuitem', { name: /analyze rule/i }));

    expect(mockOpenAssistant).toHaveBeenCalledTimes(1);
    const call = mockOpenAssistant.mock.calls[0][0];
    expect(call.origin).toBe('alerting/analyze-rule-menu-item');
    expect(call.autoSend).toBe(true);
    expect(call.context[0].data.rule).toEqual({
      name: 'alert-rule-uid',
      title: 'High CPU usage',
      labels: { severity: 'critical', team: 'infra' },
      expressions: alertRule.spec.expressions,
      annotations: { summary: 'CPU usage is too high' },
    });
    expect(call.prompt).toContain('High CPU usage');
    expect(call.prompt).toContain('alert-rule-uid');
    expect(call.prompt).toContain('CPU usage is too high');
    expect(call.prompt).toContain('severity="critical", team="infra"');
  });

  it('opens the Assistant with structured context mapped from a RecordingRule resource, without alert-specific fields', async () => {
    const user = userEvent.setup();
    renderAnalyzeButton({ kind: 'recording', rule: recordingRule });

    await user.click(screen.getByRole('menuitem', { name: /analyze rule/i }));

    const call = mockOpenAssistant.mock.calls[0][0];
    expect(call.context[0].data.rule).toEqual({
      name: 'recording-rule-uid',
      title: 'CPU usage average',
      labels: { team: 'infra' },
      expressions: recordingRule.spec.expressions,
      metric: 'cpu_usage:avg',
      targetDatasourceUID: 'prometheus-uid',
    });
    expect(call.context[0].data.rule).not.toHaveProperty('annotations');
    expect(call.prompt).not.toMatch(/firing|instances|routing|notification/i);
    expect(call.prompt).toContain('cpu_usage:avg');
    expect(call.prompt).toContain('prometheus-uid');
  });

  it('never presents a missing alert rule state as "firing"', async () => {
    const user = userEvent.setup();
    const ruleWithoutState: AlertRule = { ...alertRule, status: undefined };
    renderAnalyzeButton({ kind: 'alert', rule: ruleWithoutState });

    await user.click(screen.getByRole('menuitem', { name: /analyze rule/i }));

    const call = mockOpenAssistant.mock.calls[0][0];
    expect(call.prompt).not.toMatch(/firing/i);
  });

  it('includes the alert rule state in the prompt when the API provides it', async () => {
    const user = userEvent.setup();
    const firingRule: AlertRule = { ...alertRule, status: { state: 'Firing' } };
    renderAnalyzeButton({ kind: 'alert', rule: firingRule });

    await user.click(screen.getByRole('menuitem', { name: /analyze rule/i }));

    const call = mockOpenAssistant.mock.calls[0][0];
    expect(call.prompt).toContain('currently Firing');
  });
});
