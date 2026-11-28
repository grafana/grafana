import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { type AppKey, type SignalCoverage, setOverview } from '../liveScenario';
import { emptyOverview } from '../testFixtures';

import { DrilldownSignals } from './DrilldownSignals';

const APP_URLS: Partial<Record<AppKey, string>> = {
  metrics: '/a/grafana-metricsdrilldown-app/drilldown',
  logs: '/a/grafana-lokiexplore-app/explore',
  traces: '/a/grafana-exploretraces-app/explore',
  profiles: '/a/grafana-pyroscope-app/explore',
  sql: '/a/grafana-sql-app/explore',
};

// Only the data source is read from a signal, so the counts stay empty.
const signal = (app: AppKey, noSource = false): SignalCoverage => ({
  app,
  question: '',
  covered: 0,
  total: 0,
  unit: 'services',
  missing: [],
  noSource,
});

const withSignals = (signals: SignalCoverage[]) => setOverview({ ...emptyOverview, signals });

afterEach(() => {
  setOverview(emptyOverview);
});

describe('DrilldownSignals', () => {
  it('starts from a signal, with a tile for each one that names it and says what it shows', () => {
    withSignals([signal('metrics'), signal('logs'), signal('traces'), signal('profiles'), signal('sql')]);

    render(<DrilldownSignals appUrls={APP_URLS} />);

    expect(screen.getByRole('heading', { name: 'Start from a signal' })).toBeInTheDocument();
    expect(screen.getByText('Browse every metric by label, no PromQL needed.')).toBeInTheDocument();
    expect(screen.getByText('See log volume and patterns for each service.')).toBeInTheDocument();
    expect(screen.getByText('Find slow and failing requests across services.')).toBeInTheDocument();
    expect(screen.getByText('See which function burns the CPU or memory.')).toBeInTheDocument();
    expect(screen.getByText('See slow queries in your Postgres and MySQL databases.')).toBeInTheDocument();
    expect(screen.queryByText(/Not set up yet/)).not.toBeInTheDocument();
  });

  it('opens each app from its button', () => {
    withSignals([signal('metrics'), signal('logs'), signal('traces')]);

    render(<DrilldownSignals appUrls={APP_URLS} />);

    expect(screen.getByRole('link', { name: 'View all metrics' })).toHaveAttribute('href', APP_URLS.metrics);
    expect(screen.getByRole('link', { name: 'View all logs' })).toHaveAttribute('href', APP_URLS.logs);
    expect(screen.getByRole('link', { name: 'View all traces' })).toHaveAttribute('href', APP_URLS.traces);
  });

  it('says a signal with no data source is not set up, and offers to configure it', () => {
    withSignals([signal('metrics'), signal('profiles', true), signal('sql', true)]);

    render(<DrilldownSignals appUrls={APP_URLS} />);

    expect(screen.getByText('Not set up yet. See which function burns the CPU or memory.')).toBeInTheDocument();
    expect(
      screen.getByText('Not set up yet. See slow queries in your Postgres and MySQL databases.')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Configure profiles' })).toHaveAttribute('href', APP_URLS.profiles);
    expect(screen.getByRole('link', { name: 'Configure SQL' })).toHaveAttribute('href', APP_URLS.sql);
    expect(screen.queryByRole('link', { name: 'View all profiles' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View all metrics' })).toBeInTheDocument();
  });

  it('offers to view a signal once it has a data source', () => {
    withSignals([signal('profiles'), signal('sql')]);

    render(<DrilldownSignals appUrls={APP_URLS} />);

    expect(screen.getByRole('link', { name: 'View all profiles' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View all SQL' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Configure/ })).not.toBeInTheDocument();
  });

  it('has no button for an app that is not installed', () => {
    withSignals([signal('metrics'), signal('logs')]);

    render(<DrilldownSignals appUrls={{ logs: APP_URLS.logs }} />);

    expect(screen.queryByRole('link', { name: 'View all metrics' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View all logs' })).toBeInTheDocument();
  });
});
