import { render, screen, waitFor } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';
import { mockCombinedRule, mockGrafanaRulerRule, mockPromAlert } from '../../mocks';

import { AlertInstanceNotificationAction } from './AlertInstanceNotificationAction';

jest.mock('../../useRouteGroupsMatcher');

setupMswServer();

const instance = mockPromAlert();

describe('AlertInstanceNotificationAction', () => {
  it('renders nothing when the rule has no Grafana alerting ruler rule', async () => {
    // default mockCombinedRule uses mockRulerAlertingRule() which is a Prometheus rule
    const rule = mockCombinedRule();
    render(<AlertInstanceNotificationAction rule={rule} instance={instance} />);
    await waitFor(() => expect(screen.queryByRole('button')).not.toBeInTheDocument());
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders a contact point link when notification_settings.receiver is set', async () => {
    const rule = mockCombinedRule({
      rulerRule: mockGrafanaRulerRule({ notification_settings: { receiver: 'slack' } }),
    });
    render(<AlertInstanceNotificationAction rule={rule} instance={instance} />);
    expect(await screen.findByText('slack')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /view route/i })).not.toBeInTheDocument();
  });

  it('renders a "View route" button for notification-policy routing', async () => {
    const rule = mockCombinedRule({
      rulerRule: mockGrafanaRulerRule(), // no receiver, no notification_settings
    });
    render(<AlertInstanceNotificationAction rule={rule} instance={instance} />);
    expect(await screen.findByRole('button', { name: /view route/i })).toBeInTheDocument();
  });

  it('shows a contact point name and View route button when routing resolves to a single receiver', async () => {
    // Default instance {alertname, severity} matches only the catch-all sub-route → single receiver
    const rule = mockCombinedRule({ rulerRule: mockGrafanaRulerRule() });
    render(<AlertInstanceNotificationAction rule={rule} instance={instance} />);
    // ContactPointLink renders the receiver name once routing settles
    expect(await screen.findByText('provisioned-contact-point')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view route/i })).toBeInTheDocument();
  });

  it('shows only the View route button when routing resolves to multiple receivers', async () => {
    // Labels matching sub-route 1 (continue: true) also fall through to the catch-all → two receivers
    const multiReceiverInstance = mockPromAlert({
      labels: { sub1matcher1: 'sub1value1', sub1matcher2: 'sub1value2' },
    });
    const rule = mockCombinedRule({ rulerRule: mockGrafanaRulerRule() });
    render(<AlertInstanceNotificationAction rule={rule} instance={multiReceiverInstance} />);
    expect(await screen.findByRole('button', { name: /view route/i })).toBeInTheDocument();
    // singlePolicyReceiver is undefined when multiple receivers match — no contact point name shown
    expect(screen.queryByText('a-receiver')).not.toBeInTheDocument();
    expect(screen.queryByText('provisioned-contact-point')).not.toBeInTheDocument();
  });
});
