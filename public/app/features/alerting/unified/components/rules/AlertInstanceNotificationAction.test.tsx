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
});
