import { render, screen, waitFor } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';
import { mockCombinedRule, mockGrafanaRulerRule, mockPromAlert } from '../../mocks';

import { AlertInstanceNotificationAction, routingTreeNamesMatch } from './AlertInstanceNotificationAction';

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
    expect(screen.queryByRole('button', { name: /view route(s)?/i })).not.toBeInTheDocument();
  });

  it('renders a "View route" button for notification-policy routing', async () => {
    const rule = mockCombinedRule({
      rulerRule: mockGrafanaRulerRule(), // no receiver, no notification_settings
    });
    render(<AlertInstanceNotificationAction rule={rule} instance={instance} />);
    // Button is rendered immediately but disabled while routing data is loading.
    const button = screen.getByRole('button', { name: /view route(s)?/i });
    expect(button).toBeDisabled();
    // Once routing resolves the button becomes enabled.
    await waitFor(() => expect(button).toBeEnabled());
  });

  it('shows a contact point name and View route button when routing resolves to a single receiver', async () => {
    // Default instance {alertname, severity} matches only the catch-all sub-route → single receiver
    const rule = mockCombinedRule({ rulerRule: mockGrafanaRulerRule() });
    render(<AlertInstanceNotificationAction rule={rule} instance={instance} />);
    // ContactPointLink renders the receiver name once routing settles
    expect(await screen.findByText('provisioned-contact-point')).toBeInTheDocument();
    // Button is enabled once routing is fresh.
    expect(screen.getByRole('button', { name: /view route/i })).toBeEnabled();
  });

  it('shows only the View route button when routing resolves to multiple receivers', async () => {
    // Labels matching sub-route 1 (continue: true) also fall through to the catch-all → two receivers
    const multiReceiverInstance = mockPromAlert({
      labels: {
        sub1matcher1: 'sub1value1',
        sub1matcher2: 'sub1value2',
        sub1matcher3: 'sub1value3',
        sub1matcher4: 'sub1value4',
      },
    });
    const rule = mockCombinedRule({ rulerRule: mockGrafanaRulerRule() });
    render(<AlertInstanceNotificationAction rule={rule} instance={multiReceiverInstance} />);
    // singlePolicyReceiver is undefined when multiple receivers match — no contact point name shown
    expect(screen.queryByText('a-receiver')).not.toBeInTheDocument();
    expect(screen.queryByText('provisioned-contact-point')).not.toBeInTheDocument();
    // Instead, a clickable "N contact points" affordance is shown above the View policies button.
    // Tests render the singular source default; runtime uses the _other plural form.
    expect(await screen.findByRole('button', { name: /2 contact point/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view route/i })).toBeInTheDocument();
  });
});

describe('routingTreeNamesMatch', () => {
  it.each([
    ['user-defined', 'default'],
    ['default', 'user-defined'],
    ['user-defined', 'user-defined'],
    [undefined, 'user-defined'],
    [undefined, undefined],
  ])('treats default-tree names %p and %p as the same tree', (a, b) => {
    expect(routingTreeNamesMatch(a, b)).toBe(true);
  });

  it('matches two identical named trees', () => {
    expect(routingTreeNamesMatch('team-backend', 'team-backend')).toBe(true);
  });

  it('does not match two different named trees', () => {
    expect(routingTreeNamesMatch('team-a', 'team-b')).toBe(false);
  });

  it('does not match a named tree against the default tree', () => {
    expect(routingTreeNamesMatch('team-a', 'default')).toBe(false);
  });
});
