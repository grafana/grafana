import { render, screen, testWithFeatureToggles, userEvent } from 'test/test-utils';

import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { useAssistant } from '@grafana/assistant';
import { config } from '@grafana/runtime';
import { Menu } from '@grafana/ui';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { mockGrafanaPromAlertingRule, mockPromRecordingRule } from '../../mocks';

import { AnalyzeRuleButton } from './AnalizeRuleButton';

jest.mock('@grafana/assistant', () => ({
  useAssistant: jest.fn(),
  createAssistantContextItem: jest.fn((type, data) => ({ type, ...data })),
}));
const mockUseAssistant = jest.mocked(useAssistant);
const openAssistant = jest.fn();

const expressions = {
  A: { datasourceUID: 'prom-uid', model: { expr: 'up == 0', refId: 'A' }, source: true },
};

function mockAlertRuleResource(spec: Partial<AlertRule['spec']> = {}, status?: AlertRule['status']): AlertRule {
  return {
    apiVersion: 'rules.alerting.grafana.app/v0alpha1',
    kind: 'AlertRule',
    metadata: { name: 'k8s-alert-uid' },
    spec: {
      title: 'k8s alert',
      expressions,
      execErrState: 'Error',
      noDataState: 'NoData',
      trigger: { interval: '1m' },
      labels: { severity: 'critical' },
      annotations: { description: 'Instance is down' },
      ...spec,
    },
    status,
  };
}

function mockRecordingRuleResource(): RecordingRule {
  return {
    apiVersion: 'rules.alerting.grafana.app/v0alpha1',
    kind: 'RecordingRule',
    metadata: { name: 'k8s-recording-uid' },
    spec: {
      title: 'k8s recording',
      expressions,
      metric: 'instance:up:count',
      targetDatasourceUID: 'target-ds-uid',
      trigger: { interval: '1m' },
      labels: { team: 'sre' },
    },
  };
}

function renderButton(props: React.ComponentProps<typeof AnalyzeRuleButton>) {
  return render(
    <Menu>
      <AnalyzeRuleButton {...props} />
    </Menu>
  );
}

async function clickAnalyze() {
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Analyze rule' }));
  expect(openAssistant).toHaveBeenCalledTimes(1);
  return openAssistant.mock.calls[0][0];
}

describe('AnalyzeRuleButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAssistant.mockReturnValue({
      isLoading: false,
      isAvailable: true,
      openAssistant,
    } as unknown as ReturnType<typeof useAssistant>);
  });

  it('renders nothing when the assistant is unavailable', () => {
    mockUseAssistant.mockReturnValue({
      isLoading: false,
      isAvailable: false,
      openAssistant: undefined,
    } as unknown as ReturnType<typeof useAssistant>);

    renderButton({ alertRule: mockAlertRuleResource() });

    expect(screen.queryByRole('menuitem', { name: 'Analyze rule' })).not.toBeInTheDocument();
  });

  describe('Prometheus alerting rule', () => {
    it('includes state, activeAt, description and labels in the prompt and the rule in the context', async () => {
      const promRule = {
        ...mockGrafanaPromAlertingRule({
          uid: 'prom-uid',
          name: 'prom alert',
          query: 'up == 0',
          state: PromAlertingRuleState.Firing,
          annotations: { description: 'Instance is down' },
          labels: { severity: 'warning' },
        }),
        activeAt: '2024-01-02T03:04:05.000Z',
      };

      renderButton({ promRule });
      const call = await clickAnalyze();

      expect(call).toEqual({
        origin: 'alerting/analyze-rule-menu-item',
        mode: 'assistant',
        autoSend: true,
        prompt: `
  Analyze the firing alert "prom alert (uid: prom-uid)" starting at 2024-01-02T03:04:05.000Z.
- Get the rule definition, read the queries and run them to understand the rule
- Get the rule state and instances to understand its current state
- Read the rule conditions and understand how it works. Then suggest query and conditions improvements if applicable
   Instance is down Labels: severity="warning".`,
        context: [
          {
            type: 'structured',
            title: 'Alert: prom alert',
            data: { rule: { name: 'prom alert', uid: 'prom-uid', labels: { severity: 'warning' }, query: 'up == 0' } },
          },
        ],
      });
    });

    it('does not claim a state when the rule has none', async () => {
      const promRule = mockGrafanaPromAlertingRule({ uid: 'prom-uid', name: 'prom alert', state: undefined });

      renderButton({ promRule });
      const call = await clickAnalyze();

      expect(call.prompt).toContain('Analyze the alert "prom alert (uid: prom-uid)".');
      expect(call.prompt).not.toContain('firing');
    });
  });

  describe('with alertingTriage enabled', () => {
    testWithFeatureToggles({ enable: ['alertingTriage'] });

    const originalUnifiedAlerting = config.unifiedAlerting;

    afterEach(() => {
      config.unifiedAlerting = originalUnifiedAlerting;
    });

    it('adds the alerts page navigation hint to the prompt when state history writes to Prometheus', async () => {
      config.unifiedAlerting = {
        ...originalUnifiedAlerting,
        stateHistory: { backend: 'prometheus', prometheusTargetDatasourceUID: 'prom-uid' },
      };
      renderButton({ promRule: mockGrafanaPromAlertingRule() });
      const call = await clickAnalyze();

      expect(call.prompt).toContain('- Include navigation to the alerts page ONLY if the alert is firing or pending');
    });

    it('leaves out the alerts page navigation hint when state history does not write to Prometheus', async () => {
      renderButton({ promRule: mockGrafanaPromAlertingRule() });
      const call = await clickAnalyze();

      expect(call.prompt).not.toContain('Include navigation to the alerts page');
    });
  });

  describe('Kubernetes AlertRule', () => {
    it('builds prompt and context from the resource, using status.state', async () => {
      renderButton({ alertRule: mockAlertRuleResource({}, { state: 'Pending' }) });
      const call = await clickAnalyze();

      expect(call.prompt).toContain('Analyze the pending alert "k8s alert (uid: k8s-alert-uid)".');
      expect(call.prompt).not.toContain('starting at');
      expect(call.prompt).toContain('Instance is down Labels: severity="critical".');
      expect(call.context).toEqual([
        {
          type: 'structured',
          title: 'Alert: k8s alert',
          data: {
            rule: {
              name: 'k8s alert',
              uid: 'k8s-alert-uid',
              labels: { severity: 'critical' },
              query: JSON.stringify(expressions),
            },
          },
        },
      ]);
    });

    it('does not claim a state when status is missing', async () => {
      renderButton({ alertRule: mockAlertRuleResource() });
      const call = await clickAnalyze();

      expect(call.prompt).toContain('Analyze the alert "k8s alert (uid: k8s-alert-uid)".');
    });
  });

  describe('recording rules', () => {
    it('uses the recording prompt for a Prometheus recording rule', async () => {
      const promRule = { ...mockPromRecordingRule({ name: 'prom recording' }), uid: 'rec-uid', folderUid: 'folder' };

      renderButton({ promRule });
      const call = await clickAnalyze();

      expect(call.prompt).toBe('Analyze the recording rule "prom recording". Labels: cluster="eu-central".');
      expect(call.context[0].title).toBe('Recording rule: prom recording');
      expect(call.context[0].data.rule).toEqual({
        name: 'prom recording',
        uid: 'rec-uid',
        labels: { cluster: 'eu-central' },
        query: 'bar < 3',
      });
    });

    it('uses the recording prompt with metric and target data source for a Kubernetes RecordingRule', async () => {
      renderButton({ recordingRule: mockRecordingRuleResource() });
      const call = await clickAnalyze();

      expect(call.prompt).toBe(
        'Analyze the recording rule "k8s recording". Records metric: instance:up:count. Target data source UID: target-ds-uid. Labels: team="sre".'
      );
      expect(call.context[0].data.rule).toEqual({
        name: 'k8s recording',
        uid: 'k8s-recording-uid',
        labels: { team: 'sre' },
        query: JSON.stringify(expressions),
      });
    });
  });
});
