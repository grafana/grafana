import { render, screen } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';

import { setupBackendSrv } from '../../mockApi';
import { mockCombinedRule } from '../../mocks';
import { alertingFactory } from '../../mocks/server/db';
import { setupDataSources } from '../../testSetup/datasources';

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
});
