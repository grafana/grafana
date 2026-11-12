import { render, screen } from 'test/test-utils';

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

beforeEach(() => {
  setupDataSources();
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

  it('renders nothing when neither usage metrics nor notification history are available', () => {
    const { container } = render(<DetailsTabs usageMetricsAvailable={false} range={range} />);

    expect(container).toBeEmptyDOMElement();
  });
});
