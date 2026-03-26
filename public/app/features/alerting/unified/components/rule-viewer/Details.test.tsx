import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';

import { setupBackendSrv } from '../../mockApi';
import { mockCombinedRule } from '../../mocks';
import { alertingFactory } from '../../mocks/server/db';
import inhibitionRulesHandlers from '../../mocks/server/handlers/k8s/inhibitionRules.k8s';
import { ALERTING_API_SERVER_BASE_URL, getK8sResponse } from '../../mocks/server/utils';
import { setupDataSources } from '../../testSetup/datasources';
import { GRAFANA_FOLDER_LABEL, MATCHER_ALERT_RULE_UID } from '../../utils/constants';

import { RECEIVER_NAME, listContactPointsScenario } from './ContactPointLink.scenario';
import { Details } from './Details';

const server = setupMockServer();

beforeAll(() => {
  setupBackendSrv();
  setupDataSources();
});

describe('Details', () => {
  beforeEach(() => {
    // we'll re-use the scenario from the contact point link component
    server.use(...listContactPointsScenario);
    // register the inhibition rules handler (returns empty list by default)
    server.use(...inhibitionRulesHandlers);
  });

  it('should show paused rule', () => {
    const rule = mockCombinedRule({
      rulerRule: alertingFactory.ruler.grafana.recordingRule.build({
        grafana_alert: {
          is_paused: true,
        },
      }),
    });

    render(<Details rule={rule} />);
    expect(screen.getByText(/Alert evaluation currently paused/i)).toBeInTheDocument();
  });

  it('should render simplified routing information', async () => {
    const rule = mockCombinedRule({
      rulerRule: alertingFactory.ruler.grafana.alertingRule.build({
        grafana_alert: {
          notification_settings: {
            receiver: RECEIVER_NAME,
            active_time_intervals: ['ati1', 'ati2'],
            group_by: ['g1', 'g2'],
            group_interval: '6m',
            group_wait: '15m',
            repeat_interval: '6h',
            mute_time_intervals: ['mti1', 'mti2'],
          },
        },
      }),
    });

    render(<Details rule={rule} />);

    // wait for the reciever link to be loaded
    expect(await screen.findByRole('link', { name: RECEIVER_NAME })).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'ati1' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ati2' })).toBeInTheDocument();

    expect(screen.getByText(/g1, g2/i)).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'mti1' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'mti2' })).toBeInTheDocument();

    expect(screen.getByText(/6m/i)).toBeInTheDocument();
    expect(screen.getByText(/15m/i)).toBeInTheDocument();
    expect(screen.getByText(/6h/i)).toBeInTheDocument();
  });

  describe('alertingPolicyRoutingSettings flag ON', () => {
    beforeEach(() => {
      jest.replaceProperty(config, 'featureToggles', {
        ...config.featureToggles,
        alertingPolicyRoutingSettings: true,
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should display notification policy name as a link to the policy tree when notification_settings.policy is set', () => {
      const POLICY_NAME = 'TestPolicy';
      const rule = mockCombinedRule({
        rulerRule: alertingFactory.ruler.grafana.alertingRule.build({
          grafana_alert: {
            notification_settings: {
              policy: POLICY_NAME,
            },
          },
        }),
      });

      render(<Details rule={rule} />);

      expect(screen.getByText('Notification policy')).toBeInTheDocument();
      const policyLink = screen.getByRole('link', { name: POLICY_NAME });
      expect(policyLink).toBeInTheDocument();
      expect(policyLink).toHaveAttribute('href', expect.stringContaining(`includeTree=${POLICY_NAME}`));
      expect(policyLink).toHaveAttribute('href', expect.stringContaining('alertmanager=grafana'));
      expect(screen.queryByText('Contact point')).not.toBeInTheDocument();
    });

    it('should display "Default policy" as a link to the default policy tree when notification_settings is absent', () => {
      const rule = mockCombinedRule({
        rulerRule: alertingFactory.ruler.grafana.alertingRule.build({
          grafana_alert: {
            notification_settings: undefined,
          },
        }),
      });

      render(<Details rule={rule} />);

      expect(screen.getByText('Notification policy')).toBeInTheDocument();
      const policyLink = screen.getByRole('link', { name: 'Default policy' });
      expect(policyLink).toBeInTheDocument();
      expect(policyLink).toHaveAttribute('href', expect.stringContaining('includeTree=user-defined'));
      expect(policyLink).toHaveAttribute('href', expect.stringContaining('alertmanager=grafana'));
    });

    it('should display legacy __grafana_managed_route__ label value as a link to the policy tree', () => {
      const POLICY_NAME = 'LegacyPolicy';
      const rule = mockCombinedRule({
        rulerRule: alertingFactory.ruler.grafana.alertingRule.build({
          grafana_alert: {
            notification_settings: undefined,
          },
          labels: { __grafana_managed_route__: POLICY_NAME },
        }),
      });

      render(<Details rule={rule} />);

      expect(screen.getByText('Notification policy')).toBeInTheDocument();
      const policyLink = screen.getByRole('link', { name: POLICY_NAME });
      expect(policyLink).toBeInTheDocument();
      expect(policyLink).toHaveAttribute('href', expect.stringContaining(`includeTree=${POLICY_NAME}`));
      expect(policyLink).toHaveAttribute('href', expect.stringContaining('alertmanager=grafana'));
      expect(screen.queryByText('Default policy')).not.toBeInTheDocument();
    });
  });

  describe('alertingPolicyRoutingSettings flag OFF', () => {
    beforeEach(() => {
      jest.replaceProperty(config, 'featureToggles', {
        ...config.featureToggles,
        alertingPolicyRoutingSettings: false,
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should not show Notification configuration section when notification_settings is absent', () => {
      const rule = mockCombinedRule({
        rulerRule: alertingFactory.ruler.grafana.alertingRule.build({
          grafana_alert: {
            notification_settings: undefined,
          },
        }),
      });

      render(<Details rule={rule} />);

      expect(screen.queryByText('Notification configuration')).not.toBeInTheDocument();
    });

    it('should not show policy name even if notification_settings.policy is set (flag off = show contact point path)', () => {
      const POLICY_NAME = 'TestPolicy';
      const rule = mockCombinedRule({
        rulerRule: alertingFactory.ruler.grafana.alertingRule.build({
          grafana_alert: {
            notification_settings: {
              policy: POLICY_NAME,
            },
          },
        }),
      });

      render(<Details rule={rule} />);

      // With the flag OFF, the policy name should NOT be displayed
      expect(screen.queryByText('Notification policy')).not.toBeInTheDocument();
      expect(screen.queryByText(POLICY_NAME)).not.toBeInTheDocument();
    });
  });

  describe('inhibition rules', () => {
    function makeInhibitionRuleHandler(
      sourceMatcher: { label: string; type: string; value: string },
      targetMatcher: { label: string; type: string; value: string }
    ) {
      return http.get(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/inhibitionrules`, () =>
        HttpResponse.json(
          getK8sResponse('InhibitionRuleList', [
            {
              apiVersion: 'notifications.alerting.grafana.app/v0alpha1',
              kind: 'InhibitionRule',
              metadata: { name: 'test-inhibition-rule', namespace: 'default' },
              spec: {
                source_matchers: [sourceMatcher],
                target_matchers: [targetMatcher],
                equal: ['instance'],
              },
            },
          ])
        )
      );
    }

    it('should show inhibition details when rule matches as a target via grafana_folder system label', async () => {
      server.use(
        makeInhibitionRuleHandler(
          { label: 'alertname', type: '=', value: 'NodeDown' },
          { label: GRAFANA_FOLDER_LABEL, type: '=', value: 'mockCombinedNamespace' }
        )
      );

      // rule.labels is empty — grafana_folder is NOT a user-defined label
      const rule = mockCombinedRule({
        rulerRule: alertingFactory.ruler.grafana.alertingRule.build(),
        labels: {},
      });

      render(<Details rule={rule} />);

      expect(await screen.findByRole('alert', { name: /may be suppressed by/i })).toBeInTheDocument();
    });

    it('should show inhibition details when rule matches as a target via __alert_rule_uid__ system label', async () => {
      const ruleUid = 'test-uid-abc123';

      server.use(
        makeInhibitionRuleHandler(
          { label: 'alertname', type: '=', value: 'NodeDown' },
          { label: MATCHER_ALERT_RULE_UID, type: '=', value: ruleUid }
        )
      );

      const rule = mockCombinedRule({
        uid: ruleUid,
        rulerRule: alertingFactory.ruler.grafana.alertingRule.build(),
        labels: {},
      });

      render(<Details rule={rule} />);

      expect(await screen.findByRole('alert', { name: /may be suppressed by/i })).toBeInTheDocument();
    });

    it('should show inhibition details when rule matches as a target via alertname system label', async () => {
      server.use(
        makeInhibitionRuleHandler(
          { label: 'alertname', type: '=', value: 'NodeDown' },
          { label: 'alertname', type: '=', value: 'mockRule' }
        )
      );

      // rule.name is 'mockRule' (default) — alertname is NOT a user-defined label
      const rule = mockCombinedRule({
        rulerRule: alertingFactory.ruler.grafana.alertingRule.build(),
        labels: {},
      });

      render(<Details rule={rule} />);

      expect(await screen.findByRole('alert', { name: /may be suppressed by/i })).toBeInTheDocument();
    });

    it('should show inhibition details when rule matches as a source via alertname system label', async () => {
      server.use(
        makeInhibitionRuleHandler(
          { label: 'alertname', type: '=', value: 'mockRule' },
          { label: GRAFANA_FOLDER_LABEL, type: '=', value: 'mockCombinedNamespace' }
        )
      );

      const rule = mockCombinedRule({
        rulerRule: alertingFactory.ruler.grafana.alertingRule.build(),
        labels: {},
      });

      render(<Details rule={rule} />);

      // severity="info" renders role="status" in Grafana's Alert component
      expect(await screen.findByRole('status', { name: /may suppress alerts matched by/i })).toBeInTheDocument();
    });

    it('should not show inhibition details when no inhibition rules match', async () => {
      server.use(
        makeInhibitionRuleHandler(
          { label: 'alertname', type: '=', value: 'NodeDown' },
          { label: GRAFANA_FOLDER_LABEL, type: '=', value: 'some-other-folder' }
        )
      );

      const rule = mockCombinedRule({
        rulerRule: alertingFactory.ruler.grafana.alertingRule.build(),
        labels: {},
      });

      render(<Details rule={rule} />);

      // wait for async inhibition rules fetch to resolve
      await screen.findByText('Rule type');
      expect(screen.queryByRole('alert', { name: /may be suppressed by/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('alert', { name: /may suppress alerts matched by/i })).not.toBeInTheDocument();
    });
  });
});
