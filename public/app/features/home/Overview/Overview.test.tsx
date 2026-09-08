import { act, render, screen, waitFor, within } from 'test/test-utils';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { ctaClicked } from '../analytics/main';
import { deferred, stubDatasource, stubSolution } from '../solutions/test-utils';
import { type Solution } from '../solutions/types';

import { Overview } from './Overview';
import { useGuides } from './useGuides';
import { useOverviewPlacement } from './useOverviewPlacement';

jest.mock('../analytics/main', () => ({ ctaClicked: jest.fn() }));
jest.mock('./useGuides', () => ({ useGuides: jest.fn() }));

const mockUseGuides = jest.mocked(useGuides);
const mockCtaClicked = jest.mocked(ctaClicked);
const EMPTY_SOLUTIONS: Solution[] = [];

const guide = {
  id: 'app-monitoring',
  title: 'Set up app monitoring',
  description: 'Visualize traces, metrics, and logs from services you build and run.',
  icon: 'apps' as const,
  color: '#ff780a',
  cta: 'Start setup',
  href: '#',
};

function Harness({ solutions }: { solutions: Solution[] }) {
  return <Overview placement={useOverviewPlacement(solutions)} />;
}

describe('Overview', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseGuides.mockReset().mockReturnValue([]);
    mockCtaClicked.mockClear();
  });

  it('hides the filter while guides load and omits Get started when they settle empty', async () => {
    mockUseGuides.mockReturnValue(undefined);
    const { user, rerender } = render(<Harness solutions={EMPTY_SOLUTIONS} />);

    // Cards settled, guides still loading: the filter stays hidden so its label cannot flip.
    expect(await screen.findByText('Recommended getting started guides')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /all solutions|get started/i })).not.toBeInTheDocument();

    mockUseGuides.mockReturnValue([]);
    rerender(<Harness solutions={EMPTY_SOLUTIONS} />);

    await user.click(await screen.findByRole('button', { name: /all solutions/i }));
    expect(screen.queryByRole('menuitem', { name: 'Get started' })).not.toBeInTheDocument();
  });

  it('renders guide skeletons and then the loaded guide', async () => {
    mockUseGuides.mockReturnValue(undefined);
    const { rerender, container } = render(<Harness solutions={EMPTY_SOLUTIONS} />);

    // Guides still loading + no live solution: the unset default already lands on Get started.
    const heading = (await screen.findByText('Recommended getting started guides')).parentElement;
    expect(heading).not.toBeNull();
    expect(within(heading!).queryByText('0')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.react-loading-skeleton').length).toBeGreaterThan(0);

    mockUseGuides.mockReturnValue([guide]);
    rerender(<Harness solutions={EMPTY_SOLUTIONS} />);

    expect(await screen.findByRole('button', { name: /get started/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: guide.title })).toBeInTheDocument();
  });

  it('defaults to Get started when no solution is live and guides are available', async () => {
    mockUseGuides.mockReturnValue([guide]);
    const metrics = stubSolution('metrics', {
      title: 'Metrics & infrastructure',
      offer: async () => ({
        availability: 'enable',
        description: 'Connect Prometheus-compatible metrics.',
        cta: { label: 'Enable', href: '/plugins/grafana-metricsdrilldown-app/', action: 'enable' },
      }),
    });

    render(<Harness solutions={[metrics]} />);

    // An available (offer-only) solution is not "enabled": guides still win the default.
    expect(await screen.findByRole('button', { name: /get started/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: guide.title })).toBeInTheDocument();
  });

  it('keeps the All solutions default when a solution is live', async () => {
    mockUseGuides.mockReturnValue([guide]);
    const metrics = stubSolution('metrics', {
      title: 'Metrics & infrastructure',
      datasource: async () => stubDatasource,
    });

    render(<Harness solutions={[metrics]} />);

    expect(await screen.findByRole('heading', { name: metrics.title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /all solutions/i })).toBeInTheDocument();
  });

  it('respects a stored preference over the empty-instance default', async () => {
    mockUseGuides.mockReturnValue([guide]);
    window.localStorage.setItem('grafana.home.overview.option', 'all-solutions');

    render(<Harness solutions={EMPTY_SOLUTIONS} />);

    expect(await screen.findByText('No solutions were found.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /all solutions/i })).toBeInTheDocument();
  });

  it('falls back to All solutions on an empty instance when guides settle empty', async () => {
    mockUseGuides.mockReturnValue([]);

    render(<Harness solutions={EMPTY_SOLUTIONS} />);

    expect(await screen.findByText('No solutions were found.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /all solutions/i })).toBeInTheDocument();
  });

  it('hides the filter until solutions settle so the default never flips in view', async () => {
    mockUseGuides.mockReturnValue([guide]);
    const probe = deferred<DataSourceInstanceListItem | null>();
    const metrics = stubSolution('metrics', { title: 'Metrics & infrastructure', datasource: () => probe.promise });

    render(<Harness solutions={[metrics]} />);

    // While classification is pending there is no filter to read a transient All solutions from.
    expect(screen.queryByRole('button', { name: /all solutions|get started/i })).not.toBeInTheDocument();

    await act(async () => probe.resolve(null));

    // The filter appears only once, already on the settled default.
    expect(await screen.findByRole('button', { name: /get started/i })).toBeInTheDocument();
  });

  it('selects the overview option from the hash anchor', async () => {
    const scrollIntoView = jest.fn();
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;

    try {
      mockUseGuides.mockReturnValue([guide]);

      const metrics = stubSolution('metrics', {
        title: 'Metrics & infrastructure',
        datasource: async () => stubDatasource,
      });
      render(<Harness solutions={[metrics]} />, { historyOptions: { initialEntries: ['/#get-started'] } });

      await waitFor(() => expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument());
      expect(screen.getByText('Recommended getting started guides')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Set up app monitoring' })).toBeInTheDocument();
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
    } finally {
      window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it('handles the hash once and never overrides a later filter pick', async () => {
    const scrollIntoView = jest.fn();
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;

    try {
      const { user, rerender } = render(<Harness solutions={EMPTY_SOLUTIONS} />, {
        historyOptions: { initialEntries: ['/#needs-attention'] },
      });

      await screen.findByText('No solutions need attention.');
      expect(scrollIntoView).toHaveBeenCalledTimes(1);

      await user.click(screen.getByRole('button', { name: /needs attention/i }));
      await user.click(screen.getByRole('menuitem', { name: 'All solutions' }));
      await screen.findByText('No solutions were found.');

      // A guides change rebuilds the options; the already-handled hash must not re-apply.
      mockUseGuides.mockReturnValue([guide]);
      rerender(<Harness solutions={EMPTY_SOLUTIONS} />);

      expect(await screen.findByText('No solutions were found.')).toBeInTheDocument();
      expect(screen.queryByText('No solutions need attention.')).not.toBeInTheDocument();
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
    } finally {
      window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it('clears the hash on an explicit filter pick and honors the next deep link', async () => {
    const scrollIntoView = jest.fn();
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;

    try {
      const { user } = render(<Harness solutions={EMPTY_SOLUTIONS} />, {
        historyOptions: { initialEntries: ['/#needs-attention'] },
      });

      await screen.findByText('No solutions need attention.');
      expect(locationService.getLocation().hash).toBe('#needs-attention');

      await user.click(screen.getByRole('button', { name: /needs attention/i }));
      await user.click(screen.getByRole('menuitem', { name: 'All solutions' }));

      await screen.findByText('No solutions were found.');
      expect(locationService.getLocation().hash).toBe('');

      // The cleared anchor must work again as a fresh deep link.
      act(() => locationService.push('/#needs-attention'));
      expect(await screen.findByText('No solutions need attention.')).toBeInTheDocument();
      expect(scrollIntoView).toHaveBeenCalledTimes(2);
    } finally {
      window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it('clears an unrecognized anchor on an explicit filter pick', async () => {
    const { user } = render(<Harness solutions={EMPTY_SOLUTIONS} />, {
      historyOptions: { initialEntries: ['/?orgId=1#needs-aattention'] },
    });

    // The typo'd anchor selects nothing.
    await screen.findByText('No solutions were found.');

    await user.click(screen.getByRole('button', { name: /all solutions/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Enabled solutions' }));

    await screen.findByText('No enabled solutions with recent activity were found.');
    expect(locationService.getLocation().hash).toBe('');
    expect(locationService.getLocation().search).toContain('orgId=1');
  });

  it('tracks overview filter changes from the dropdown', async () => {
    mockUseGuides.mockReturnValue([]);

    const { user } = render(<Harness solutions={EMPTY_SOLUTIONS} />);

    await screen.findByText('No solutions were found.');
    await user.click(screen.getByRole('button', { name: /all solutions/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Needs attention' }));

    expect(mockCtaClicked).toHaveBeenCalledWith({
      surface: 'overview',
      action: 'change_overview_filter',
      placement: 'menu',
      solution: 'needs-attention',
    });
  });

  it('renders each card as soon as its own classification settles', async () => {
    window.localStorage.setItem('grafana.home.overview.option', 'all-solutions');
    const logsAttention = deferred<boolean>();
    const firstStats = jest.fn(async () => ({ primary: '4.2 M series' }));
    const metrics = stubSolution('metrics', {
      title: 'Metrics & infrastructure',
      signal: async () => 'active',
      datasource: async () => stubDatasource,
      stats: firstStats,
    });
    const logs = stubSolution('logs', {
      title: 'Logs',
      signal: async () => 'active',
      datasource: async () => stubDatasource,
      needsAttention: () => logsAttention.promise,
    });

    render(<Harness solutions={[metrics, logs]} />);

    // Metrics settles on its own: its card paints while the logs card still awaits its group.
    expect(await screen.findByRole('heading', { name: metrics.title })).toBeInTheDocument();
    expect(await screen.findByText('4.2 M series')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: logs.title })).not.toBeInTheDocument();
    expect(screen.getAllByTestId('solution-card-skeleton')).toHaveLength(1);

    await act(async () => logsAttention.resolve(false));

    expect(await screen.findByRole('heading', { name: logs.title })).toBeInTheDocument();
    expect(screen.queryByTestId('solution-card-skeleton')).not.toBeInTheDocument();
    // The already-placed card was not remounted by its sibling settling.
    expect(firstStats).toHaveBeenCalledTimes(1);
  });

  it('returns to skeletons while a changed solution set is classified', async () => {
    const tracesDatasource = deferred<DataSourceInstanceListItem | null>();
    const nextDatasource = deferred<DataSourceInstanceListItem | null>();
    const metrics = stubSolution('metrics', {
      title: 'Metrics & infrastructure',
      datasource: async () => stubDatasource,
    });
    const traces = stubSolution('traces', {
      title: 'Traces',
      datasource: () => tracesDatasource.promise,
    });
    const logs = stubSolution('logs', {
      title: 'Logs',
      datasource: () => nextDatasource.promise,
    });
    const { rerender } = render(<Harness solutions={[metrics, traces]} />);

    expect(await screen.findByRole('heading', { name: metrics.title })).toBeInTheDocument();
    expect(screen.getAllByTestId('solution-card-skeleton')).toHaveLength(1);

    rerender(<Harness solutions={[logs]} />);

    // A late answer for a solution no longer in the set must not surface.
    await act(async () => tracesDatasource.resolve(stubDatasource));

    expect(screen.getAllByTestId('solution-card-skeleton')).toHaveLength(1);
    expect(screen.queryByRole('heading', { name: metrics.title })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: traces.title })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: logs.title })).not.toBeInTheDocument();

    await act(async () => nextDatasource.resolve(stubDatasource));

    expect(await screen.findByRole('heading', { name: logs.title })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: traces.title })).not.toBeInTheDocument();
    expect(screen.queryByTestId('solution-card-skeleton')).not.toBeInTheDocument();
  });

  it('keeps placed cards when the solution array is recreated with the same solutions', async () => {
    const metrics = stubSolution('metrics', {
      title: 'Metrics & infrastructure',
      datasource: async () => stubDatasource,
    });
    const solutions = [metrics];
    const { rerender } = render(<Harness solutions={solutions} />);

    expect(await screen.findByRole('heading', { name: metrics.title })).toBeInTheDocument();

    rerender(<Harness solutions={[...solutions]} />);

    // No flash back to a skeleton while the (memoized) facts are re-read.
    expect(screen.getByRole('heading', { name: metrics.title })).toBeInTheDocument();
    expect(screen.queryByTestId('solution-card-skeleton')).not.toBeInTheDocument();

    await act(async () => {});

    expect(screen.getByRole('heading', { name: metrics.title })).toBeInTheDocument();
    expect(screen.queryByTestId('solution-card-skeleton')).not.toBeInTheDocument();
  });

  it('holds offers behind skeletons until a live card settles when no view preference is stored', async () => {
    mockUseGuides.mockReturnValue([guide]);
    const logsDatasource = deferred<DataSourceInstanceListItem | null>();
    const metrics = stubSolution('metrics', {
      title: 'Metrics & infrastructure',
      offer: async () => ({
        availability: 'enable',
        description: 'Connect Prometheus-compatible metrics.',
        cta: { label: 'Enable', href: '/plugins/grafana-metricsdrilldown-app/', action: 'enable' },
      }),
    });
    const logs = stubSolution('logs', { title: 'Logs', datasource: () => logsDatasource.promise });
    const others = (['traces', 'kubernetes', 'synthetics'] as const).map((id) =>
      stubSolution(id, { datasource: () => new Promise<null>(() => {}) })
    );

    render(<Harness solutions={[metrics, logs, ...others]} />);

    // The offer has settled, but a live card could still arrive and flip the default to All
    // solutions, so the grid stays on skeletons: one per solution.
    await waitFor(() => expect(screen.getAllByTestId('solution-card-skeleton')).toHaveLength(5));
    expect(screen.queryByRole('heading', { name: metrics.title })).not.toBeInTheDocument();

    await act(async () => logsDatasource.resolve(stubDatasource));

    expect(await screen.findByRole('heading', { name: logs.title })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: metrics.title })).toBeInTheDocument();
    expect(screen.getAllByTestId('solution-card-skeleton')).toHaveLength(3);
  });

  it('renders a settled offer immediately when a view preference is stored', async () => {
    mockUseGuides.mockReturnValue([guide]);
    window.localStorage.setItem('grafana.home.overview.option', 'all-solutions');
    const metrics = stubSolution('metrics', {
      title: 'Metrics & infrastructure',
      offer: async () => ({
        availability: 'enable',
        description: 'Connect Prometheus-compatible metrics.',
        cta: { label: 'Enable', href: '/plugins/grafana-metricsdrilldown-app/', action: 'enable' },
      }),
    });
    const logs = stubSolution('logs', { title: 'Logs', datasource: () => new Promise<null>(() => {}) });

    render(<Harness solutions={[metrics, logs]} />);

    expect(await screen.findByRole('heading', { name: metrics.title })).toBeInTheDocument();
    expect(screen.getAllByTestId('solution-card-skeleton')).toHaveLength(1);
  });

  it('classifies a live solution as enabled when its attention query fails', async () => {
    const metrics = stubSolution('metrics', {
      title: 'Metrics & infrastructure',
      signal: async () => 'active',
      datasource: async () => stubDatasource,
      needsAttention: async () => {
        throw new Error('health unavailable');
      },
    });

    render(<Harness solutions={[metrics]} />);

    expect(await screen.findByRole('heading', { name: 'Enabled' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Needs attention' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: metrics.title })).toBeInTheDocument();
  });

  it('settles instead of holding skeletons when required facts reject', async () => {
    const metrics = stubSolution('metrics', {
      datasource: async () => {
        throw new Error('datasource lookup failed');
      },
      offer: async () => {
        throw new Error('plugin inventory failed');
      },
    });

    render(<Harness solutions={[metrics]} />);

    expect(await screen.findByText('No solutions were found.')).toBeInTheDocument();
    expect(document.querySelectorAll('.react-loading-skeleton')).toHaveLength(0);
  });

  it('keeps optional card facts progressive after placement', async () => {
    const stats = deferred<{ primary: string } | null>();
    const metrics = stubSolution('metrics', {
      title: 'Metrics & infrastructure',
      signal: async () => 'active',
      datasource: async () => stubDatasource,
      stats: () => stats.promise,
    });

    const { container } = render(<Harness solutions={[metrics]} />);

    expect(await screen.findByRole('heading', { name: metrics.title })).toBeInTheDocument();
    expect(screen.queryByText('4.2 M series')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.react-loading-skeleton').length).toBeGreaterThan(0);

    await act(async () => stats.resolve({ primary: '4.2 M series' }));

    expect(await screen.findByText('4.2 M series')).toBeInTheDocument();
  });

  it('groups attention and enabled cards and filters without reclassifying them', async () => {
    const attentionAlert = jest.fn(async () => ({ primary: '3 hosts above 90% disk' }));
    const enabledAlert = jest.fn(async () => null);
    const attention = stubSolution('metrics', {
      title: 'Metrics & infrastructure',
      datasource: async () => stubDatasource,
      needsAttention: async () => true,
      alert: attentionAlert,
    });
    const enabled = stubSolution('logs', {
      title: 'Logs',
      datasource: async () => stubDatasource,
      alert: enabledAlert,
    });
    const { user } = render(<Harness solutions={[attention, enabled]} />);

    expect(await screen.findByRole('heading', { name: 'Needs attention' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Enabled' })).toBeInTheDocument();
    expect(await screen.findByText('3 hosts above 90% disk')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /all solutions/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Enabled solutions' }));

    expect(screen.queryByRole('heading', { name: attention.title })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: enabled.title })).toBeInTheDocument();
    expect(attentionAlert).toHaveBeenCalledTimes(1);
    expect(enabledAlert).not.toHaveBeenCalled();
  });

  it('loads alert details after placing an attention card', async () => {
    const alert = deferred<{ primary: string } | null>();
    const metrics = stubSolution('metrics', {
      title: 'Metrics & infrastructure',
      datasource: async () => stubDatasource,
      needsAttention: async () => true,
      alert: () => alert.promise,
    });

    render(<Harness solutions={[metrics]} />);

    expect(await screen.findByRole('heading', { name: 'Needs attention' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: metrics.title })).toBeInTheDocument();
    expect(screen.queryByText('3 hosts above 90% disk')).not.toBeInTheDocument();

    await act(async () => alert.resolve({ primary: '3 hosts above 90% disk' }));

    expect(await screen.findByText('3 hosts above 90% disk')).toBeInTheDocument();
  });

  it('shows offers through the Available filter', async () => {
    const metrics = stubSolution('metrics', {
      title: 'Metrics & infrastructure',
      offer: async () => ({
        availability: 'enable',
        description: 'Connect Prometheus-compatible metrics.',
        cta: { label: 'Enable', href: '/plugins/grafana-metricsdrilldown-app/', action: 'enable' },
      }),
    });
    const { user } = render(<Harness solutions={[metrics]} />);

    expect(await screen.findByRole('heading', { name: metrics.title })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /all solutions/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Available solutions' }));

    expect(screen.getByRole('heading', { name: 'Available' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Enable' })).toBeInTheDocument();
  });
});
