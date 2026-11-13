import { render, screen } from 'test/test-utils';

import { config } from '@grafana/runtime';

import { setupMswServer } from '../../mockApi';
import { setupDataSources } from '../../testSetup/datasources';

import { DetailsTabs } from './DetailsTabs';
import { getDefaultHomeRange } from './homeRange';

// The Insights charts are Scenes panels, which need the plugin runtime that jsdom does not have.
// Their queries are covered by the Insights scenes; here we only test which tabs and sections show.
jest.mock('./DetailsCharts', () => ({
  UsageChart: ({ kind }: { kind: string }) => <div>{kind} chart</div>,
  DeliveryOverTimeChart: () => <div>delivery over time chart</div>,
}));
// Its queries are covered by its own tests.
jest.mock('./MissedEvaluationsTable', () => ({
  MissedEvaluationsTable: () => <div>rules that missed the most</div>,
}));

setupMswServer();

const range = getDefaultHomeRange();
const delivery = { attempts: 10, failed: 0, channels: [{ integration: 'email', attempts: 10, failed: 0 }] };

const notificationHistoryEnabled = config.unifiedAlerting.notificationHistoryEnabled;
const stateHistory = config.unifiedAlerting.stateHistory;

beforeEach(() => {
  setupDataSources();
  config.unifiedAlerting.notificationHistoryEnabled = true;
});

afterEach(() => {
  config.unifiedAlerting.notificationHistoryEnabled = notificationHistoryEnabled;
  config.unifiedAlerting.stateHistory = stateHistory;
});

describe('DetailsTabs', () => {
  it('shows both tabs, starting on rule evaluation, when usage metrics are available', async () => {
    render(<DetailsTabs usageMetricsAvailable delivery={delivery} range={range} />);

    expect(await screen.findByRole('tab', { name: 'Rule evaluation' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Alert notifications' })).toHaveAttribute('aria-selected', 'false');
    expect(
      ['instances', 'rules-evaluating', 'evaluation-success', 'missed'].map((kind) => screen.getByText(`${kind} chart`))
    ).toHaveLength(4);
    expect(screen.getByText('rules that missed the most')).toBeInTheDocument();
  });

  it('shows the Alertmanager charts and delivery by channel on the alert notifications tab', async () => {
    const { user } = render(<DetailsTabs usageMetricsAvailable delivery={delivery} range={range} />);

    await user.click(await screen.findByRole('tab', { name: 'Alert notifications' }));

    expect(screen.getByText('alertmanager-alerts chart')).toBeInTheDocument();
    expect(screen.getByText('silences chart')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Delivery by channel' })).toBeInTheDocument();
    expect(screen.queryByText('instances chart')).not.toBeInTheDocument();
  });

  it('shows only alert notifications, with delivery by channel, when only notification history is available', async () => {
    render(<DetailsTabs usageMetricsAvailable={false} delivery={delivery} range={range} />);

    expect(await screen.findByRole('tab', { name: 'Alert notifications' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: 'Rule evaluation' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Delivery by channel' })).toHaveTextContent('email10');
    expect(screen.queryByText('alertmanager-alerts chart')).not.toBeInTheDocument();
  });

  it('draws delivery over time when notification history returned a time series', async () => {
    const overTime = { times: [1, 2], sent: [3, 4], failed: [0, 1] };

    render(<DetailsTabs usageMetricsAvailable={false} delivery={{ ...delivery, overTime }} range={range} />);

    expect(await screen.findByText('delivery over time chart')).toBeInTheDocument();
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

  it('points to alert state history for the same range as the best place to learn about rule evaluation', async () => {
    config.unifiedAlerting.stateHistory = { ...stateHistory, backend: 'loki' };

    render(<DetailsTabs usageMetricsAvailable delivery={delivery} range={range} />);

    const callout = await screen.findByRole('region', { name: 'Alert state history' });
    expect(callout).toHaveTextContent(
      'The best place to learn about your rule evaluations: every state change of every alert instance, when it happened and what the rule returned.'
    );
    expect(screen.getByRole('link', { name: 'Open alert state history' })).toHaveAttribute(
      'href',
      '/alerting/history?from=now-7d&to=now'
    );
  });

  it('leaves out the alert state history link when state history is not available', async () => {
    render(<DetailsTabs usageMetricsAvailable delivery={delivery} range={range} />);

    expect(await screen.findByText('instances chart')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open alert state history' })).not.toBeInTheDocument();
  });

  it('leaves out the notification history link when notification history is off', async () => {
    config.unifiedAlerting.notificationHistoryEnabled = false;

    const { user } = render(<DetailsTabs usageMetricsAvailable range={range} />);
    await user.click(await screen.findByRole('tab', { name: 'Alert notifications' }));

    expect(screen.getByText('alertmanager-alerts chart')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open notification history' })).not.toBeInTheDocument();
  });

  it('renders nothing when neither usage metrics nor notification history are available', () => {
    const { container } = render(<DetailsTabs usageMetricsAvailable={false} range={range} />);

    expect(container).toBeEmptyDOMElement();
  });
});
