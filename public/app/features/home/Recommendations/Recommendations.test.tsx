import { act, render, screen, userEvent, waitFor, within } from 'test/test-utils';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { interceptLinkClicks } from 'app/core/navigation/patch/interceptLinkClicks';
import { contextSrv } from 'app/core/services/context_srv';
import { type LocalPlugin } from 'app/features/plugins/admin/types';
import { AccessControlAction } from 'app/types/accessControl';

import { ctaClicked, recommendationsShown } from '../analytics/main';
import { APP_OBSERVABILITY_APP_ID, HOSTED_TRACES_APP_ID } from '../solutions/appPluginIds';
import { KUBERNETES_APP_ID } from '../solutions/kubernetesData';
import { type SignalStatus, type SolutionState } from '../solutions/solutionState';
import { type Solution, type SolutionId } from '../solutions/types';
import { type HomepageSolutions } from '../useHomepageSolutions';

import { Recommendations } from './Recommendations';
import { resetInstalledPlugins } from './pluginRecommendations';

const mockGet = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({ get: mockGet }),
}));
jest.mock('../analytics/main', () => ({ ctaClicked: jest.fn(), recommendationsShown: jest.fn() }));

const datasource: DataSourceInstanceListItem = {
  uid: 'prometheus',
  name: 'Prometheus',
  type: 'prometheus',
  meta: { id: 'prometheus' } as DataSourceInstanceListItem['meta'],
  readOnly: false,
  isDefault: true,
};

const DEFAULT_STATE: SolutionState = {
  metrics: 'active',
  logs: 'active',
  traces: 'inactive',
  kubernetes: 'inactive',
  spanMetrics: 'inactive',
  synthetics: 'inactive',
};

function plugin(id: string, enabled = false, canWrite = true, canAccess = true): LocalPlugin {
  return {
    id,
    enabled,
    accessControl: {
      [AccessControlAction.PluginsWrite]: canWrite,
      [AccessControlAction.PluginsAppAccess]: canAccess,
    },
  } as unknown as LocalPlugin;
}

function solution(
  id: SolutionId,
  status: SignalStatus,
  data: DataSourceInstanceListItem | null,
  overrides: Partial<Solution> = {}
): Solution {
  return {
    id,
    title: id,
    icon: 'chart-line',
    signal: async () => status,
    datasource: async () => data,
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

function homepageSolutions(
  state: SolutionState = DEFAULT_STATE,
  solutions: Solution[] = [],
  signals: HomepageSolutions['signals'] = jest.fn(async () => state)
): HomepageSolutions {
  return { solutions, signals };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const carouselRegion = () => screen.findByRole('region', { name: 'Recommended apps' });

function visibleRecommendationTitle(region: HTMLElement): string {
  return (
    within(region)
      .getAllByRole('heading', { level: 3, hidden: true })
      .find((heading) => heading.closest('div[aria-hidden="false"]'))
      ?.textContent?.trim() ?? ''
  );
}

beforeEach(() => {
  resetInstalledPlugins();
  window.localStorage.clear();
  mockGet.mockReset().mockResolvedValue([plugin(HOSTED_TRACES_APP_ID), plugin(KUBERNETES_APP_ID)]);
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  jest.spyOn(contextSrv, 'hasPermissionInMetadata').mockImplementation((action, metadata) => {
    return Boolean(metadata.accessControl?.[action]);
  });
  jest.mocked(ctaClicked).mockClear();
  jest.mocked(recommendationsShown).mockClear();
  document.addEventListener('click', interceptLinkClicks);
});

afterEach(() => {
  document.removeEventListener('click', interceptLinkClicks);
  jest.restoreAllMocks();
});

describe('Recommendations', () => {
  it('uses the supplied aggregate signal getter and plugin inventory', async () => {
    const signals = jest.fn(async () => DEFAULT_STATE);
    render(<Recommendations solutions={homepageSolutions(DEFAULT_STATE, [], signals)} />);

    await carouselRegion();

    expect(signals).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('renders nothing and starts no recommendation work without management permissions', () => {
    jest.mocked(contextSrv.hasPermission).mockReturnValue(false);
    const signals = jest.fn(async () => DEFAULT_STATE);
    const { container } = render(<Recommendations solutions={homepageSolutions(DEFAULT_STATE, [], signals)} />);

    expect(container).toBeEmptyDOMElement();
    expect(signals).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('holds the region skeleton until every selection input settles', async () => {
    const state = deferred<SolutionState>();
    const signals = jest.fn(() => state.promise);
    render(<Recommendations solutions={homepageSolutions(DEFAULT_STATE, [], signals)} />);

    expect(await screen.findByTestId('recommendations-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('Recommendations for your stack')).not.toBeInTheDocument();

    await act(async () => state.resolve(DEFAULT_STATE));

    expect(await screen.findByText('Recommendations for your stack')).toBeInTheDocument();
  });

  it('renders the matrix-selected cards in matrix order', async () => {
    render(<Recommendations solutions={homepageSolutions()} />);

    const region = await carouselRegion();
    expect(
      within(region)
        .getAllByRole('heading', { level: 3, hidden: true })
        .map((heading) => heading.textContent?.trim())
    ).toEqual(['Trace requests across services', 'Monitor your Kubernetes fleet']);
  });

  it('tracks shown recommendations with the matrix starting state', async () => {
    render(<Recommendations solutions={homepageSolutions()} />);

    await carouselRegion();

    await waitFor(() =>
      expect(jest.mocked(recommendationsShown)).toHaveBeenCalledWith({
        recommendation_ids: ['hosted-traces', 'kubernetes-monitoring'],
        starting_state: 'ml_no_traces',
        solution: undefined,
      })
    );
  });

  it('follows the selected solution order and resets the carousel when the solution changes', async () => {
    const metrics = solution('metrics', 'active', datasource, { title: 'Metrics & infrastructure' });
    const logs = solution(
      'logs',
      'active',
      { ...datasource, uid: 'loki', name: 'Loki', type: 'loki' },
      { title: 'Logs' }
    );
    const { user } = render(<Recommendations solutions={homepageSolutions(DEFAULT_STATE, [metrics, logs])} />);

    const region = await carouselRegion();
    expect(await screen.findByRole('heading', { name: metrics.title })).toBeInTheDocument();
    expect(visibleRecommendationTitle(region)).toBe('Monitor your Kubernetes fleet');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(visibleRecommendationTitle(region)).toBe('Trace requests across services');

    await user.click(screen.getByRole('button', { name: /switch solution/i }));
    await user.click(screen.getByRole('menuitem', { name: logs.title }));

    expect(await screen.findByRole('heading', { name: logs.title })).toBeInTheDocument();
    expect(visibleRecommendationTitle(region)).toBe('Trace requests across services');
  });

  it('does not let inactive datasource details delay the recommendation order', async () => {
    const logsDatasource = jest.fn(() => new Promise<DataSourceInstanceListItem | null>(() => {}));
    const metrics = solution('metrics', 'active', datasource, { title: 'Metrics & infrastructure' });
    const logs = solution('logs', 'inactive', null, {
      title: 'Logs',
      datasource: logsDatasource,
    });
    render(<Recommendations solutions={homepageSolutions(DEFAULT_STATE, [metrics, logs])} />);

    expect(await screen.findByRole('heading', { name: metrics.title })).toBeInTheDocument();
    expect(await carouselRegion()).toBeInTheDocument();
    expect(screen.queryByTestId('recommended-card-skeleton')).not.toBeInTheDocument();
    expect(logsDatasource).not.toHaveBeenCalled();
  });

  it('does not start selection while initially collapsed, then starts it on expansion', async () => {
    window.localStorage.setItem('grafana.home.recommendations.collapsed', 'true');
    const signals = jest.fn(async () => DEFAULT_STATE);
    const { user } = render(<Recommendations solutions={homepageSolutions(DEFAULT_STATE, [], signals)} />);

    expect(await screen.findByRole('button', { name: 'Show' })).toBeInTheDocument();
    expect(signals).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Show' }));

    expect(await screen.findByRole('link', { name: /Enable Hosted Traces/ })).toBeInTheDocument();
    expect(signals).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('keeps the mounted solution facts when collapsed and expanded again', async () => {
    const getDatasource = jest.fn(async () => datasource);
    const metrics = solution('metrics', 'active', datasource, {
      title: 'Metrics & infrastructure',
      datasource: getDatasource,
    });
    const { user } = render(<Recommendations solutions={homepageSolutions(DEFAULT_STATE, [metrics])} />);

    expect(await screen.findByRole('heading', { name: metrics.title })).toBeInTheDocument();
    const reads = getDatasource.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Hide' }));
    await user.click(screen.getByRole('button', { name: 'Show' }));

    expect(screen.getByRole('heading', { name: metrics.title })).toBeInTheDocument();
    expect(getDatasource).toHaveBeenCalledTimes(reads);
  });

  it('hides the region when detection is inconclusive', async () => {
    const unknown: SolutionState = { ...DEFAULT_STATE, logs: 'unknown' };
    const { container } = render(<Recommendations solutions={homepageSolutions(unknown)} />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('keeps connection recommendations when the plugin inventory is unavailable', async () => {
    const metricsOnly: SolutionState = { ...DEFAULT_STATE, logs: 'inactive' };
    mockGet.mockRejectedValue(new Error('plugin inventory unavailable'));
    render(<Recommendations solutions={homepageSolutions(metricsOnly)} />);

    expect(await screen.findByRole('link', { name: 'Learn more' })).toBeInTheDocument();
  });

  it('hides plugin-only recommendations when the plugin inventory is unavailable', async () => {
    mockGet.mockRejectedValue(new Error('plugin inventory unavailable'));
    const { container } = render(<Recommendations solutions={homepageSolutions()} />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('filters disabled plugin actions by scoped write permission', async () => {
    mockGet.mockResolvedValue([plugin(HOSTED_TRACES_APP_ID, false, false), plugin(KUBERNETES_APP_ID, false, true)]);
    render(<Recommendations solutions={homepageSolutions()} />);

    expect(await screen.findByRole('link', { name: /Enable Kubernetes Monitoring/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Enable Hosted Traces/ })).not.toBeInTheDocument();
  });

  it('shows connection guidance to a datasource-creation-only user', async () => {
    jest
      .mocked(contextSrv.hasPermission)
      .mockImplementation((action) => action === AccessControlAction.DataSourcesCreate);
    const metricsOnly: SolutionState = { ...DEFAULT_STATE, logs: 'inactive' };

    render(<Recommendations solutions={homepageSolutions(metricsOnly)} />);

    expect(await screen.findByRole('link', { name: 'Learn more' })).toBeInTheDocument();
  });

  it('does not show connection guidance to a plugin-management-only user', async () => {
    jest.mocked(contextSrv.hasPermission).mockImplementation((action) => action === AccessControlAction.PluginsWrite);
    const metricsOnly: SolutionState = { ...DEFAULT_STATE, logs: 'inactive' };
    const { container } = render(<Recommendations solutions={homepageSolutions(metricsOnly)} />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('uses the Kubernetes-specific logging guidance when cluster metrics are active', async () => {
    const kubernetesWithoutLogs: SolutionState = {
      ...DEFAULT_STATE,
      logs: 'inactive',
      kubernetes: 'active',
    };
    render(<Recommendations solutions={homepageSolutions(kubernetesWithoutLogs)} />);

    const link = await screen.findByRole('link', { name: 'Learn more' });
    expect(link).toHaveAttribute(
      'href',
      'https://grafana.com/docs/grafana-cloud/monitor-infrastructure/kubernetes-monitoring/configuration/'
    );
  });

  it('uses external telemetry guidance even without access to the enabled app page', async () => {
    mockGet.mockResolvedValue([plugin(HOSTED_TRACES_APP_ID, true, true, false), plugin(KUBERNETES_APP_ID, false)]);
    const { user } = render(<Recommendations solutions={homepageSolutions()} />);

    const link = await screen.findByRole('link', { name: 'Learn more' });
    expect(link).toHaveAttribute('target', '_blank');
    await user.click(link);

    expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
      surface: 'recommendations',
      action: 'learn_more',
      placement: 'card',
      recommendation_id: 'hosted-traces',
      starting_state: 'ml_no_traces',
    });
  });

  it('still requires app-page access for a non-telemetry setup action', async () => {
    const mlt: SolutionState = { ...DEFAULT_STATE, traces: 'active' };
    mockGet.mockResolvedValue([plugin(APP_OBSERVABILITY_APP_ID, true, true, false), plugin(KUBERNETES_APP_ID, false)]);

    render(<Recommendations solutions={homepageSolutions(mlt)} />);
    await carouselRegion();

    expect(screen.queryByRole('heading', { name: 'Explore your service map', hidden: true })).not.toBeInTheDocument();
  });

  it('renders and tracks an accessible in-app setup action', async () => {
    mockGet.mockResolvedValue([plugin(HOSTED_TRACES_APP_ID), plugin(KUBERNETES_APP_ID, true)]);
    const { user } = render(<Recommendations solutions={homepageSolutions()} />);

    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await user.click(await screen.findByRole('link', { name: 'Set up Kubernetes Monitoring' }));

    expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
      surface: 'recommendations',
      action: 'setup',
      placement: 'card',
      recommendation_id: 'kubernetes-monitoring',
      starting_state: 'ml_no_traces',
    });
  });

  it('does not invent install actions for plugins missing from the inventory', async () => {
    mockGet.mockResolvedValue([plugin('grafana-core-app', true)]);
    const { container } = render(<Recommendations solutions={homepageSolutions()} />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('collapses and expands an already-resolved recommendation set', async () => {
    const { user } = render(<Recommendations solutions={homepageSolutions()} />);

    expect(await screen.findByRole('button', { name: 'Hide' })).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.getByRole('button', { name: 'Show' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show' }));
    expect(screen.getByRole('button', { name: 'Hide' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('navigates with arrows and dots and exposes the carousel semantics', async () => {
    const { user } = render(<Recommendations solutions={homepageSolutions()} />);
    const region = await carouselRegion();

    expect(region).toHaveAttribute('aria-roledescription', 'carousel');
    expect(visibleRecommendationTitle(region)).toBe('Trace requests across services');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(visibleRecommendationTitle(region)).toBe('Monitor your Kubernetes fleet');
    expect(screen.getByRole('button', { name: 'Go to recommendation 1' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(visibleRecommendationTitle(region)).toBe('Trace requests across services');

    await user.click(screen.getByRole('button', { name: 'Go to recommendation 2' }));
    expect(visibleRecommendationTitle(region)).toBe('Monitor your Kubernetes fleet');
  });

  it('does not render or schedule carousel controls for a single recommendation', async () => {
    const metricsOnly: SolutionState = { ...DEFAULT_STATE, logs: 'inactive' };
    render(<Recommendations solutions={homepageSolutions(metricsOnly)} />);

    expect(await carouselRegion()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
  });

  it('starts paused when reduced motion is preferred', async () => {
    jest.spyOn(window, 'matchMedia').mockImplementation(
      () =>
        ({
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          matches: true,
        }) as unknown as MediaQueryList
    );

    render(<Recommendations solutions={homepageSolutions()} />);

    expect(await screen.findByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
  });

  it('auto-advances only while the carousel is running', async () => {
    jest.useFakeTimers();

    try {
      render(<Recommendations solutions={homepageSolutions()} />);
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const region = await carouselRegion();

      await user.click(screen.getByRole('button', { name: 'Pause' }));
      act(() => jest.advanceTimersByTime(6000));
      expect(visibleRecommendationTitle(region)).toBe('Trace requests across services');

      await user.click(screen.getByRole('button', { name: 'Resume' }));
      act(() => jest.advanceTimersByTime(6000));
      expect(visibleRecommendationTitle(region)).toBe('Monitor your Kubernetes fleet');
    } finally {
      jest.useRealTimers();
    }
  });

  it('tracks an enable action with the matrix state', async () => {
    const { user } = render(<Recommendations solutions={homepageSolutions()} />);

    await user.click(await screen.findByRole('link', { name: /Enable Hosted Traces/ }));

    expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
      surface: 'recommendations',
      action: 'enable',
      placement: 'card',
      recommendation_id: 'hosted-traces',
      starting_state: 'ml_no_traces',
    });
  });

  it('tracks an enable action from the collapsed pill', async () => {
    const { user } = render(<Recommendations solutions={homepageSolutions()} />);

    await screen.findByRole('link', { name: /Enable Hosted Traces/ });
    await user.click(screen.getByRole('button', { name: 'Hide' }));
    await user.click(screen.getByRole('link', { name: /Enable Hosted Traces/ }));

    expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
      surface: 'recommendations',
      action: 'enable',
      placement: 'pill',
      recommendation_id: 'hosted-traces',
      starting_state: 'ml_no_traces',
    });
  });

  it('tracks external guidance from the collapsed pill', async () => {
    const metricsOnly: SolutionState = { ...DEFAULT_STATE, logs: 'inactive' };
    const { user } = render(<Recommendations solutions={homepageSolutions(metricsOnly)} />);

    await screen.findByRole('link', { name: 'Learn more' });
    await user.click(screen.getByRole('button', { name: 'Hide' }));
    const pill = screen.getByRole('link', { name: 'Add logs' });
    expect(pill).toHaveAttribute('target', '_blank');
    expect(pill).toHaveAttribute('rel', 'noopener noreferrer');
    await user.click(pill);

    expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
      surface: 'recommendations',
      action: 'learn_more',
      placement: 'pill',
      recommendation_id: 'enable-logs',
      starting_state: 'metrics_only',
    });
  });
});
