import { act, render, screen, waitFor, within } from 'test/test-utils';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { ctaClicked } from '../analytics/main';
import { type Solution, type SolutionId } from '../solutions/types';

import { Overview } from './Overview';
import { useGuides } from './useGuides';

jest.mock('../analytics/main', () => ({ ctaClicked: jest.fn() }));
jest.mock('./useGuides', () => ({ useGuides: jest.fn() }));

const mockUseGuides = jest.mocked(useGuides);
const mockCtaClicked = jest.mocked(ctaClicked);
const EMPTY_SOLUTIONS: Solution[] = [];

const datasource: DataSourceInstanceListItem = {
  uid: 'datasource',
  name: 'Datasource',
  type: 'prometheus',
  meta: { id: 'prometheus' } as DataSourceInstanceListItem['meta'],
  readOnly: false,
  isDefault: true,
};

const guide = {
  id: 'app-monitoring',
  title: 'Set up app monitoring',
  description: 'Visualize traces, metrics, and logs from services you build and run.',
  icon: 'apps' as const,
  color: '#ff780a',
  cta: 'Start setup',
  href: '#',
};

function solution(id: SolutionId, overrides: Partial<Solution> = {}): Solution {
  return {
    id,
    title: id,
    icon: 'chart-line',
    signal: async () => 'inactive',
    datasource: async () => null,
    needsAttention: async () => false,
    stats: async () => null,
    refinedStats: async () => null,
    sparkline: async () => null,
    cta: async () => null,
    alert: async () => null,
    offer: async () => null,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('Overview', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseGuides.mockReset().mockReturnValue([]);
    mockCtaClicked.mockClear();
  });

  it('hides the filter while guides load and omits Get started when they settle empty', async () => {
    mockUseGuides.mockReturnValue(undefined);
    const { user, rerender } = render(<Overview solutions={EMPTY_SOLUTIONS} />);

    // Cards settled, guides still loading: the filter stays hidden so its label cannot flip.
    expect(await screen.findByText('Recommended getting started guides')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /all solutions|get started/i })).not.toBeInTheDocument();

    mockUseGuides.mockReturnValue([]);
    rerender(<Overview solutions={EMPTY_SOLUTIONS} />);

    await user.click(await screen.findByRole('button', { name: /all solutions/i }));
    expect(screen.queryByRole('menuitem', { name: 'Get started' })).not.toBeInTheDocument();
  });

  it('renders guide skeletons and then the loaded guide', async () => {
    mockUseGuides.mockReturnValue(undefined);
    const { rerender, container } = render(<Overview solutions={EMPTY_SOLUTIONS} />);

    // Guides still loading + no live solution: the unset default already lands on Get started.
    const heading = (await screen.findByText('Recommended getting started guides')).parentElement;
    expect(heading).not.toBeNull();
    expect(within(heading!).queryByText('0')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.react-loading-skeleton').length).toBeGreaterThan(0);

    mockUseGuides.mockReturnValue([guide]);
    rerender(<Overview solutions={EMPTY_SOLUTIONS} />);

    expect(await screen.findByRole('button', { name: /get started/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: guide.title })).toBeInTheDocument();
  });

  it('defaults to Get started when no solution is live and guides are available', async () => {
    mockUseGuides.mockReturnValue([guide]);
    const metrics = solution('metrics', {
      title: 'Metrics & infrastructure',
      offer: async () => ({
        availability: 'enable',
        description: 'Connect Prometheus-compatible metrics.',
        cta: { label: 'Enable', href: '/plugins/grafana-metricsdrilldown-app/', action: 'enable' },
      }),
    });

    render(<Overview solutions={[metrics]} />);

    // An available (offer-only) solution is not "enabled": guides still win the default.
    expect(await screen.findByRole('button', { name: /get started/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: guide.title })).toBeInTheDocument();
  });

  it('keeps the All solutions default when a solution is live', async () => {
    mockUseGuides.mockReturnValue([guide]);
    const metrics = solution('metrics', { title: 'Metrics & infrastructure', datasource: async () => datasource });

    render(<Overview solutions={[metrics]} />);

    expect(await screen.findByRole('heading', { name: metrics.title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /all solutions/i })).toBeInTheDocument();
  });

  it('respects a stored preference over the empty-instance default', async () => {
    mockUseGuides.mockReturnValue([guide]);
    window.localStorage.setItem('grafana.home.overview.option', 'all-solutions');

    render(<Overview solutions={EMPTY_SOLUTIONS} />);

    expect(await screen.findByText('No solutions were found.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /all solutions/i })).toBeInTheDocument();
  });

  it('falls back to All solutions on an empty instance when guides settle empty', async () => {
    mockUseGuides.mockReturnValue([]);

    render(<Overview solutions={EMPTY_SOLUTIONS} />);

    expect(await screen.findByText('No solutions were found.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /all solutions/i })).toBeInTheDocument();
  });

  it('hides the filter until solutions settle so the default never flips in view', async () => {
    mockUseGuides.mockReturnValue([guide]);
    const probe = deferred<DataSourceInstanceListItem | null>();
    const metrics = solution('metrics', { title: 'Metrics & infrastructure', datasource: () => probe.promise });

    render(<Overview solutions={[metrics]} />);

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

      const metrics = solution('metrics', { title: 'Metrics & infrastructure', datasource: async () => datasource });
      render(<Overview solutions={[metrics]} />, { historyOptions: { initialEntries: ['/#get-started'] } });

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
      const { user, rerender } = render(<Overview solutions={EMPTY_SOLUTIONS} />, {
        historyOptions: { initialEntries: ['/#needs-attention'] },
      });

      await screen.findByText('No solutions need attention.');
      expect(scrollIntoView).toHaveBeenCalledTimes(1);

      await user.click(screen.getByRole('button', { name: /needs attention/i }));
      await user.click(screen.getByRole('menuitem', { name: 'All solutions' }));
      await screen.findByText('No solutions were found.');

      // A guides change rebuilds the options; the already-handled hash must not re-apply.
      mockUseGuides.mockReturnValue([guide]);
      rerender(<Overview solutions={EMPTY_SOLUTIONS} />);

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
      const { user } = render(<Overview solutions={EMPTY_SOLUTIONS} />, {
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
    const { user } = render(<Overview solutions={EMPTY_SOLUTIONS} />, {
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

    const { user } = render(<Overview solutions={EMPTY_SOLUTIONS} />);

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

  it('does not render any card until every required classification has settled', async () => {
    const logsAttention = deferred<boolean>();
    const firstStats = jest.fn(async () => ({ primary: '4.2 M series' }));
    const metricsDatasource = jest.fn(async () => datasource);
    const logsDatasource = jest.fn(async () => datasource);
    const metrics = solution('metrics', {
      title: 'Metrics & infrastructure',
      signal: async () => 'active',
      datasource: metricsDatasource,
      stats: firstStats,
    });
    const logs = solution('logs', {
      title: 'Logs',
      signal: async () => 'active',
      datasource: logsDatasource,
      needsAttention: () => logsAttention.promise,
    });

    const { container } = render(<Overview solutions={[metrics, logs]} />);

    await waitFor(() => expect(metricsDatasource).toHaveBeenCalled());
    expect(logsDatasource).toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: metrics.title })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: logs.title })).not.toBeInTheDocument();
    expect(firstStats).not.toHaveBeenCalled();
    expect(container.querySelectorAll('.react-loading-skeleton').length).toBeGreaterThan(0);

    await act(async () => logsAttention.resolve(false));

    expect(await screen.findByRole('heading', { name: metrics.title })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: logs.title })).toBeInTheDocument();
    expect(firstStats).toHaveBeenCalledTimes(1);
  });

  it('returns to skeletons while a changed solution set is classified', async () => {
    const nextDatasource = deferred<DataSourceInstanceListItem | null>();
    const metrics = solution('metrics', {
      title: 'Metrics & infrastructure',
      datasource: async () => datasource,
    });
    const logs = solution('logs', {
      title: 'Logs',
      datasource: () => nextDatasource.promise,
    });
    const { container, rerender } = render(<Overview solutions={[metrics]} />);

    expect(await screen.findByRole('heading', { name: metrics.title })).toBeInTheDocument();
    await waitFor(() => expect(container.querySelectorAll('.react-loading-skeleton')).toHaveLength(0));

    rerender(<Overview solutions={[logs]} />);

    await waitFor(() => expect(container.querySelectorAll('.react-loading-skeleton').length).toBeGreaterThan(0));
    expect(screen.queryByRole('heading', { name: metrics.title })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: logs.title })).not.toBeInTheDocument();

    await act(async () => nextDatasource.resolve(datasource));

    expect(await screen.findByRole('heading', { name: logs.title })).toBeInTheDocument();
  });

  it('classifies a live solution as enabled when its attention query fails', async () => {
    const metrics = solution('metrics', {
      title: 'Metrics & infrastructure',
      signal: async () => 'active',
      datasource: async () => datasource,
      needsAttention: async () => {
        throw new Error('health unavailable');
      },
    });

    render(<Overview solutions={[metrics]} />);

    expect(await screen.findByRole('heading', { name: 'Enabled' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Needs attention' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: metrics.title })).toBeInTheDocument();
  });

  it('settles instead of holding skeletons when required facts reject', async () => {
    const metrics = solution('metrics', {
      datasource: async () => {
        throw new Error('datasource lookup failed');
      },
      offer: async () => {
        throw new Error('plugin inventory failed');
      },
    });

    render(<Overview solutions={[metrics]} />);

    expect(await screen.findByText('No solutions were found.')).toBeInTheDocument();
    expect(document.querySelectorAll('.react-loading-skeleton')).toHaveLength(0);
  });

  it('keeps optional card facts progressive after placement', async () => {
    const stats = deferred<{ primary: string } | null>();
    const metrics = solution('metrics', {
      title: 'Metrics & infrastructure',
      signal: async () => 'active',
      datasource: async () => datasource,
      stats: () => stats.promise,
    });

    const { container } = render(<Overview solutions={[metrics]} />);

    expect(await screen.findByRole('heading', { name: metrics.title })).toBeInTheDocument();
    expect(screen.queryByText('4.2 M series')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.react-loading-skeleton').length).toBeGreaterThan(0);

    await act(async () => stats.resolve({ primary: '4.2 M series' }));

    expect(await screen.findByText('4.2 M series')).toBeInTheDocument();
  });

  it('groups attention and enabled cards and filters without reclassifying them', async () => {
    const attentionAlert = jest.fn(async () => ({ primary: '3 hosts above 90% disk' }));
    const enabledAlert = jest.fn(async () => null);
    const attention = solution('metrics', {
      title: 'Metrics & infrastructure',
      datasource: async () => datasource,
      needsAttention: async () => true,
      alert: attentionAlert,
    });
    const enabled = solution('logs', { title: 'Logs', datasource: async () => datasource, alert: enabledAlert });
    const { user } = render(<Overview solutions={[attention, enabled]} />);

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
    const metrics = solution('metrics', {
      title: 'Metrics & infrastructure',
      datasource: async () => datasource,
      needsAttention: async () => true,
      alert: () => alert.promise,
    });

    render(<Overview solutions={[metrics]} />);

    expect(await screen.findByRole('heading', { name: 'Needs attention' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: metrics.title })).toBeInTheDocument();
    expect(screen.queryByText('3 hosts above 90% disk')).not.toBeInTheDocument();

    await act(async () => alert.resolve({ primary: '3 hosts above 90% disk' }));

    expect(await screen.findByText('3 hosts above 90% disk')).toBeInTheDocument();
  });

  it('shows offers through the Available filter', async () => {
    const metrics = solution('metrics', {
      title: 'Metrics & infrastructure',
      offer: async () => ({
        availability: 'enable',
        description: 'Connect Prometheus-compatible metrics.',
        cta: { label: 'Enable', href: '/plugins/grafana-metricsdrilldown-app/', action: 'enable' },
      }),
    });
    const { user } = render(<Overview solutions={[metrics]} />);

    expect(await screen.findByRole('heading', { name: metrics.title })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /all solutions/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Available solutions' }));

    expect(screen.getByRole('heading', { name: 'Available' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Enable' })).toBeInTheDocument();
  });
});
