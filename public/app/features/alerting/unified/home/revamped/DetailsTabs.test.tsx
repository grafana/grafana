import { render, screen } from 'test/test-utils';

import { config } from '@grafana/runtime';

import { setupMswServer } from '../../mockApi';
import { setupDataSources } from '../../testSetup/datasources';

import { DetailsTabs } from './DetailsTabs';
import { getDefaultHomeRange } from './homeRange';

// The Insights charts are Scenes panels, which need the plugin runtime that jsdom does not have.
// Their queries are covered by the Insights scenes; here we only test which tabs and sections show.
jest.mock('./DetailsCharts', () => ({
  RuleEvaluationCharts: () => <div>rule evaluation charts</div>,
  NotificationCharts: () => <div>notification charts</div>,
}));

setupMswServer();

const range = getDefaultHomeRange();
const delivery = { attempts: 10, failed: 0, channels: [{ integration: 'email', attempts: 10, failed: 0 }] };

const notificationHistoryEnabled = config.unifiedAlerting.notificationHistoryEnabled;

beforeEach(() => {
  setupDataSources();
  config.unifiedAlerting.notificationHistoryEnabled = true;
});

afterEach(() => {
  config.unifiedAlerting.notificationHistoryEnabled = notificationHistoryEnabled;
});

describe('DetailsTabs', () => {
  it('shows both tabs, starting on rule evaluation, when usage metrics are available', async () => {
    render(<DetailsTabs usageMetricsAvailable delivery={delivery} range={range} />);

    expect(await screen.findByRole('tab', { name: 'Rule evaluation' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Alert notifications' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('rule evaluation charts')).toBeInTheDocument();
  });

  it('shows the Alertmanager charts and delivery by channel on the alert notifications tab', async () => {
    const { user } = render(<DetailsTabs usageMetricsAvailable delivery={delivery} range={range} />);

    await user.click(await screen.findByRole('tab', { name: 'Alert notifications' }));

    expect(screen.getByText('notification charts')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Delivery by channel' })).toBeInTheDocument();
    expect(screen.queryByText('rule evaluation charts')).not.toBeInTheDocument();
  });

  it('shows only alert notifications, with delivery by channel, when only notification history is available', async () => {
    render(<DetailsTabs usageMetricsAvailable={false} delivery={delivery} range={range} />);

    expect(await screen.findByRole('tab', { name: 'Alert notifications' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: 'Rule evaluation' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Delivery by channel' })).toHaveTextContent('email10');
    expect(screen.queryByText('notification charts')).not.toBeInTheDocument();
  });

  it('points to notification history for the same range as the best place to learn about notifications', async () => {
    render(<DetailsTabs usageMetricsAvailable={false} delivery={delivery} range={range} />);

    const callout = await screen.findByRole('region', { name: 'Notification history' });
    expect(callout).toHaveTextContent(
      'The best place to learn about your notifications: every notification sent, the alerts it carried, where it went and whether it was delivered.'
    );
    expect(screen.getByRole('link', { name: 'Open notification history' })).toHaveAttribute(
      'href',
      '/alerting/history?tab=notifications&from=now-7d&to=now'
    );
  });

  it('leaves out the notification history link when notification history is off', async () => {
    config.unifiedAlerting.notificationHistoryEnabled = false;

    const { user } = render(<DetailsTabs usageMetricsAvailable range={range} />);
    await user.click(await screen.findByRole('tab', { name: 'Alert notifications' }));

    expect(screen.getByText('notification charts')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open notification history' })).not.toBeInTheDocument();
  });

  it('renders nothing when neither usage metrics nor notification history are available', () => {
    const { container } = render(<DetailsTabs usageMetricsAvailable={false} range={range} />);

    expect(container).toBeEmptyDOMElement();
  });
});
