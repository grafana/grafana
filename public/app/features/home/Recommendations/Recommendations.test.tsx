import { act, render, screen, userEvent, waitFor, within } from 'test/test-utils';

import { type DataSourceInstanceListItem, type PluginMeta } from '@grafana/data';
import { config } from '@grafana/runtime';
import { interceptLinkClicks } from 'app/core/navigation/patch/interceptLinkClicks';
import { contextSrv } from 'app/core/services/context_srv';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { type LocalPlugin } from 'app/features/plugins/admin/types';
import { AccessControlAction } from 'app/types/accessControl';

import { ctaClicked } from '../analytics/main';

import { Recommendations } from './Recommendations';
import { HOSTED_TRACES_APP_ID } from './appPluginIds';
import {
  fetchClusterCpuSeries,
  fetchKubernetesHealth,
  fetchKubernetesInventory,
  KUBERNETES_APP_ID,
  resolveKubernetesDatasource,
} from './kubernetesData';
import { useSolutionState } from './solutionState';
import { type SolutionState } from './solutionsMatrix';
import { fetchLogsActivity, fetchMetricsActivity } from './telemetryData';

const mockGet = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({ get: mockGet }),
}));

jest.mock('app/features/alerting/unified/hooks/usePluginBridge', () => ({
  ...jest.requireActual('app/features/alerting/unified/hooks/usePluginBridge'),
  usePluginBridge: jest.fn(),
}));

jest.mock('../analytics/main', () => ({
  ctaClicked: jest.fn(),
}));

// The RecommendationExisting child fetches its overview from Prometheus; resolve to no
// datasource so tests exercise the (deterministic) no-data card instead of hitting one.
jest.mock('./kubernetesData', () => ({
  ...jest.requireActual('./kubernetesData'),
  resolveKubernetesDatasource: jest.fn().mockResolvedValue(null),
  fetchKubernetesInventory: jest.fn().mockResolvedValue({ clusters: 0, pods: 0 }),
  fetchKubernetesHealth: jest.fn().mockResolvedValue({
    alertsFiring: null,
    unhealthyPods: null,
    restarts1h: null,
    notReadyNodes: null,
  }),
  fetchClusterCpuSeries: jest.fn().mockResolvedValue(null),
}));

jest.mock('./solutionState', () => ({
  useSolutionState: jest.fn(),
}));

jest.mock('./telemetryData', () => ({
  ...jest.requireActual('./telemetryData'),
  fetchLogsActivity: jest.fn(),
  fetchMetricsActivity: jest.fn(),
  fetchTracesActivity: jest.fn(),
  fetchTracesServices: jest.fn(),
}));

// Removed-app ids stay literal: the never-render guard must outlive their deleted constants.
const LEGACY_APP_IDS = ['grafana-synthetic-monitoring-app', 'grafana-app-observability-app', 'grafana-kowalski-app'];
const APP_IDS = [HOSTED_TRACES_APP_ID, KUBERNETES_APP_ID, ...LEGACY_APP_IDS];

const listItem = (id: string, overrides: Partial<LocalPlugin> = {}) => ({
  id,
  enabled: false,
  accessControl: { [AccessControlAction.PluginsWrite]: true, [AccessControlAction.PluginsAppAccess]: true },
  ...overrides,
});

const mockUsePluginBridge = jest.mocked(usePluginBridge);
const mockUseSolutionState = jest.mocked(useSolutionState);
const mockFetchLogsActivity = jest.mocked(fetchLogsActivity);
const mockFetchMetricsActivity = jest.mocked(fetchMetricsActivity);

const prometheusDatasource: DataSourceInstanceListItem = {
  uid: 'prom-uid',
  name: 'grafanacloud-prom',
  type: 'prometheus',
  meta: { id: 'prometheus' } as DataSourceInstanceListItem['meta'],
  readOnly: false,
  isDefault: false,
};

const lokiDatasource: DataSourceInstanceListItem = {
  uid: 'loki-uid',
  name: 'grafanacloud-logs',
  type: 'loki',
  meta: { id: 'loki' } as DataSourceInstanceListItem['meta'],
  readOnly: false,
  isDefault: false,
};

function setSolutionState(
  overrides: Partial<SolutionState>,
  ds: { loki?: DataSourceInstanceListItem; prometheus?: DataSourceInstanceListItem } = {}
) {
  // Honor the enabled gate like the real hook: a collapsed region resolves nothing.
  mockUseSolutionState.mockImplementation((enabled = true) =>
    enabled
      ? {
          value: {
            state: {
              metrics: 'inactive',
              logs: 'inactive',
              traces: 'inactive',
              kubernetes: 'inactive',
              spanMetrics: 'inactive',
              ...overrides,
            },
            lokiDatasource: ds.loki ?? null,
            tempoDatasource: null,
            prometheusDatasource: ds.prometheus ?? null,
          },
          loading: false,
        }
      : { value: undefined, loading: false }
  );
}

beforeEach(() => {
  window.localStorage.clear();
  jest.mocked(ctaClicked).mockClear();
  mockUsePluginBridge.mockReset();
  mockUsePluginBridge.mockReturnValue({
    loading: false,
    installed: true,
    settings: { id: 'grafana-k8s-app' } as PluginMeta<{}>,
  });
  mockGet.mockReset();
  mockGet.mockResolvedValue(APP_IDS.map((id) => listItem(id)));
  mockUseSolutionState.mockReset();
  mockFetchLogsActivity.mockReset();
  mockFetchLogsActivity.mockResolvedValue({ bytes: null, sources: null, series: null });
  mockFetchMetricsActivity.mockReset();
  mockFetchMetricsActivity.mockResolvedValue({
    series: null,
    names: null,
    hosts: null,
    seriesSparkline: null,
    disk: null,
  });
  // Metrics + Logs, no Traces: the two-card row (hosted-traces, kubernetes-monitoring).
  setSolutionState({ metrics: 'active', logs: 'active' });
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
});

afterEach(() => jest.restoreAllMocks());

const carouselRegion = async () => screen.findByRole('region', { name: 'Recommended apps' });

describe('Recommendations', () => {
  // The default fixtures resolve no solution datasources, so the left card is in its no-data
  // state and no solution view is active: the carousel keeps the global matrix order.
  it('renders the matrix-selected cards in matrix order for ml_no_traces', async () => {
    render(<Recommendations />);

    const region = await carouselRegion();
    const titles = within(region)
      .getAllByRole('heading', { level: 3, hidden: true })
      .map((heading) => heading.textContent?.trim());
    expect(titles).toEqual(['Trace requests across services', 'Monitor your Kubernetes fleet']);
    expect(within(region).getByRole('link', { name: /Enable Hosted Traces/ })).toBeInTheDocument();
    expect(
      within(region).getByRole('link', { name: /Enable Kubernetes Monitoring/, hidden: true })
    ).toBeInTheDocument();
  });

  it('follows the selected solution: metrics-led by default, logs-led after switching', async () => {
    setSolutionState({ metrics: 'active', logs: 'active' }, { prometheus: prometheusDatasource, loki: lokiDatasource });
    mockFetchMetricsActivity.mockResolvedValue({
      series: 4_200_000,
      names: null,
      hosts: 12,
      seriesSparkline: null,
      disk: null,
    });
    mockFetchLogsActivity.mockResolvedValue({ bytes: 47_000_000_000, sources: 8, series: null });

    const { user } = render(<Recommendations />);

    // The left card defaults to the first registry entry (kubernetes resolves no datasource).
    expect(await screen.findByRole('heading', { name: 'Metrics & infrastructure' })).toBeInTheDocument();

    const region = await carouselRegion();
    const titles = () =>
      within(region)
        .getAllByRole('heading', { level: 3, hidden: true })
        .map((heading) => heading.textContent?.trim());
    // The metrics view leads with K8s Monitoring — the reverse of the matrix order.
    expect(titles()).toEqual(['Monitor your Kubernetes fleet', 'Trace requests across services']);

    // Advance to the second slide so the switch provably resets the carousel.
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: 'Go to recommendation 1' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Switch solution/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Hosted Logs' }));

    expect(screen.getByRole('heading', { name: 'Hosted Logs' })).toBeInTheDocument();
    // The logs view re-leads with Hosted Traces and restarts on the first slide.
    expect(titles()).toEqual(['Trace requests across services', 'Monitor your Kubernetes fleet']);
    expect(screen.queryByRole('button', { name: 'Go to recommendation 1' })).not.toBeInTheDocument();
    expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
      surface: 'existing_solution',
      action: 'switch_solution',
      placement: 'card',
      solution: 'logs',
    });
  });

  it('shows a skeleton while the solution state is resolving', async () => {
    mockUseSolutionState.mockReturnValue({ value: undefined, loading: true });

    render(<Recommendations />);

    expect(await screen.findByTestId('recommendations-skeleton')).toBeInTheDocument();
  });

  it('fills the carousel with the three telemetry pillars for an empty stack', async () => {
    setSolutionState({});

    render(<Recommendations />);

    const region = await carouselRegion();
    const titles = within(region)
      .getAllByRole('heading', { level: 3, hidden: true })
      .map((heading) => heading.textContent?.trim());
    expect(titles).toEqual([
      'Start with metrics',
      'See the story behind your metrics',
      'Trace requests across services',
    ]);
    expect(within(region).getByRole('link', { name: /Connect metrics/ })).toHaveAttribute(
      'href',
      '/connections/add-new-connection'
    );
  });

  it('holds the skeleton while a selected plugin card waits on the plugin list', async () => {
    mockGet.mockImplementation(() => new Promise(() => {}));

    render(<Recommendations />);

    expect(await screen.findByTestId('recommendations-skeleton')).toBeInTheDocument();
  });

  it('gives an enabled-but-silent app a setup CTA into the app', async () => {
    mockGet.mockResolvedValue(APP_IDS.map((id) => listItem(id, { enabled: id === 'grafana-exploretraces-app' })));

    render(<Recommendations />);

    const setupLink = await screen.findByRole('link', { name: /Set up Hosted Traces/, hidden: true });
    expect(setupLink).toHaveAttribute('href', '/a/grafana-exploretraces-app');
    expect(screen.queryByRole('link', { name: /Enable Hosted Traces/, hidden: true })).not.toBeInTheDocument();
  });

  it('hides the setup card when the user lacks app access to the silent app', async () => {
    mockGet.mockResolvedValue(
      APP_IDS.map((id) =>
        listItem(id, {
          enabled: id === 'grafana-exploretraces-app',
          accessControl:
            id === 'grafana-exploretraces-app'
              ? { [AccessControlAction.PluginsWrite]: true }
              : { [AccessControlAction.PluginsWrite]: true, [AccessControlAction.PluginsAppAccess]: true },
        })
      )
    );

    render(<Recommendations />);

    const region = await carouselRegion();
    expect(within(region).queryByRole('link', { name: /Hosted Traces/, hidden: true })).not.toBeInTheDocument();
    expect(
      within(region).getByRole('link', { name: /Enable Kubernetes Monitoring/, hidden: true })
    ).toBeInTheDocument();
  });

  it('renders a single connection card for metrics_only without carousel controls or auto-advance', async () => {
    jest.useFakeTimers();
    try {
      setSolutionState({ metrics: 'active' });

      render(<Recommendations />);

      // Flush the plugin-list fetch inside act; fake timers leave it pending otherwise.
      await act(async () => {});

      const addLogs = await screen.findByRole('link', { name: /Add Logs/ });
      expect(addLogs).toHaveAttribute('href', '/connections/add-new-connection');
      expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Go to recommendation/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(11_000);
      });

      expect(screen.getByRole('link', { name: /Add Logs/ })).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('selects the Helm-flavored logs card when kubernetes is active without logs', async () => {
    setSolutionState({ metrics: 'active', kubernetes: 'active' });

    render(<Recommendations />);

    const setupLogs = await screen.findByRole('link', { name: /Set up log collection/ });
    expect(setupLogs).toHaveAttribute('href', '/connections/add-new-connection');
  });

  it('hides the whole region when permissions filter out every card', async () => {
    setSolutionState({ metrics: 'active' });
    jest
      .mocked(contextSrv.hasPermission)
      .mockImplementation((action) => action !== AccessControlAction.DataSourcesCreate);

    const { container } = render(<Recommendations />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('keeps connection cards when the plugin fetch rejects, while plugin cards fail closed', async () => {
    // DataSourcesCreate-only user: the plugin list request fails outright.
    jest
      .mocked(contextSrv.hasPermission)
      .mockImplementation((action) => action === AccessControlAction.DataSourcesCreate);
    mockGet.mockRejectedValue(new Error('boom'));
    setSolutionState({ metrics: 'active' });

    render(<Recommendations />);

    expect(await screen.findByRole('link', { name: /Add Logs/ })).toBeInTheDocument();

    // Same failure with a plugin-card selection: both cards fail closed and the whole region hides.
    setSolutionState({ metrics: 'active', logs: 'active' });
    const { container: second } = render(<Recommendations />);

    await waitFor(() => expect(second).toBeEmptyDOMElement());
  });

  it('hides the whole region when the plugin list is empty and every card is plugin-kind', async () => {
    mockGet.mockResolvedValue([]);

    const { container } = render(<Recommendations />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('hides the whole region when any signal is unknown', async () => {
    setSolutionState({ metrics: 'active', logs: 'unknown' });

    const { container } = render(<Recommendations />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('hides the whole region when there is nothing left to recommend', async () => {
    setSolutionState({
      metrics: 'active',
      logs: 'active',
      traces: 'active',
      kubernetes: 'active',
      spanMetrics: 'active',
    });

    const { container } = render(<Recommendations />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('recommends App Observability for OTel starters, suppressed once span metrics exist', async () => {
    setSolutionState({ metrics: 'active', logs: 'active', traces: 'active' });

    const first = render(<Recommendations />);

    let region = await carouselRegion();
    const titles = within(region)
      .getAllByRole('heading', { level: 3, hidden: true })
      .map((heading) => heading.textContent?.trim());
    expect(titles).toEqual(['Explore your service map', 'Monitor your Kubernetes fleet']);

    first.unmount();
    setSolutionState({ metrics: 'active', logs: 'active', traces: 'active', spanMetrics: 'active' });
    render(<Recommendations />);

    region = await carouselRegion();
    expect(
      within(region).queryByRole('link', { name: /Application Observability/, hidden: true })
    ).not.toBeInTheDocument();
    expect(
      within(region).getByRole('link', { name: /Enable Kubernetes Monitoring/, hidden: true })
    ).toBeInTheDocument();
  });

  it('never renders the removed legacy cards, even installed and disabled', async () => {
    render(<Recommendations />);

    const region = await carouselRegion();
    expect(within(region).queryByRole('link', { name: /Synthetic Monitoring/, hidden: true })).not.toBeInTheDocument();
    expect(
      within(region).queryByRole('link', { name: /Frontend Observability/, hidden: true })
    ).not.toBeInTheDocument();
  });

  it('renders nothing when the user can manage neither plugins nor datasources', async () => {
    jest.mocked(contextSrv.hasPermission).mockReturnValue(false);

    const { container } = render(<Recommendations />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockUseSolutionState).not.toHaveBeenCalled();
  });

  it('renders the section for a datasource-creation-only user', async () => {
    jest
      .mocked(contextSrv.hasPermission)
      .mockImplementation((action) => action === AccessControlAction.DataSourcesCreate);
    setSolutionState({ metrics: 'active' });

    render(<Recommendations />);

    expect(await screen.findByRole('link', { name: /Add Logs/ })).toBeInTheDocument();
  });

  it('shows installed-but-disabled cards only with a scoped write permission', async () => {
    jest.mocked(contextSrv.hasPermission).mockImplementation((action) => action === AccessControlAction.PluginsWrite);
    mockGet.mockResolvedValue([
      listItem('grafana-exploretraces-app'),
      listItem('grafana-k8s-app', { accessControl: {} }),
    ]);

    render(<Recommendations />);

    expect(await screen.findByRole('link', { name: /Enable Hosted Traces/, hidden: true })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Enable Kubernetes Monitoring/, hidden: true })).not.toBeInTheDocument();
  });

  it('shows not-installed cards but hides installed-but-disabled ones for an install-only user', async () => {
    jest.mocked(contextSrv.hasPermission).mockImplementation((action) => action === AccessControlAction.PluginsInstall);
    mockGet.mockResolvedValue([listItem('grafana-k8s-app', { accessControl: {} })]);

    render(<Recommendations />);

    expect(await screen.findByRole('link', { name: /Enable Hosted Traces/, hidden: true })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Enable Kubernetes Monitoring/, hidden: true })).not.toBeInTheDocument();
  });

  it('hides install cards when plugin admin is disabled', async () => {
    config.pluginAdminEnabled = false;
    jest.mocked(contextSrv.hasPermission).mockImplementation((action) => action === AccessControlAction.PluginsInstall);
    mockGet.mockResolvedValue([]);

    try {
      const { container } = render(<Recommendations />);

      await waitFor(() => expect(container).toBeEmptyDOMElement());
    } finally {
      config.pluginAdminEnabled = true;
    }
  });

  it('collapses and expands the recommendations card', async () => {
    const { user } = render(<Recommendations />);

    expect(await screen.findByText('Recommendations for your stack')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide' }));

    expect(screen.getByRole('button', { name: 'Show' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show' }));

    expect(screen.getByText('Recommendations for your stack')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
  });

  it('does not refetch the existing-solution data when collapsed and expanded', async () => {
    const mockResolve = jest.mocked(resolveKubernetesDatasource);
    const mockInventory = jest.mocked(fetchKubernetesInventory);
    const mockHealth = jest.mocked(fetchKubernetesHealth);
    const mockCpu = jest.mocked(fetchClusterCpuSeries);
    mockResolve.mockClear();
    mockInventory.mockClear();
    mockHealth.mockClear();
    mockCpu.mockClear();
    const { user } = render(<Recommendations />);

    await screen.findByRole('button', { name: 'Next' });
    expect(mockResolve).toHaveBeenCalledTimes(1);
    expect(mockInventory).toHaveBeenCalledTimes(1);
    expect(mockHealth).toHaveBeenCalledTimes(1);
    expect(mockCpu).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Hide' }));
    await user.click(screen.getByRole('button', { name: 'Show' }));

    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(mockResolve).toHaveBeenCalledTimes(1);
    expect(mockInventory).toHaveBeenCalledTimes(1);
    expect(mockHealth).toHaveBeenCalledTimes(1);
    expect(mockCpu).toHaveBeenCalledTimes(1);
  });

  it('does not run Kubernetes queries while collapsed from a stored preference, mounts once on Show', async () => {
    window.localStorage.setItem('grafana.home.recommendations.collapsed', 'true');
    const mockResolve = jest.mocked(resolveKubernetesDatasource);
    mockResolve.mockClear();

    const { user } = render(<Recommendations />);

    await screen.findByText('Recommendations for your stack');
    expect(mockResolve).not.toHaveBeenCalled();

    await user.click(await screen.findByRole('button', { name: 'Show' }));
    await waitFor(() => expect(mockResolve).toHaveBeenCalledTimes(1));

    // Let the remounted view settle before toggling; a click mid-remount can hit a detached node.
    await screen.findByRole('button', { name: 'Next' });
    await user.click(screen.getByRole('button', { name: 'Hide' }));
    await screen.findByRole('button', { name: 'Show' });
    await user.click(screen.getByRole('button', { name: 'Show' }));
    expect(mockResolve).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('recommendation-existing-skeleton')).not.toBeInTheDocument();
  });

  it('resolves no solution state and fetches no plugins while collapsed from a stored preference', async () => {
    window.localStorage.setItem('grafana.home.recommendations.collapsed', 'true');

    const { user } = render(<Recommendations />);

    // The region renders header-only: no skeleton, no probes, no plugin fetch, no pills.
    expect(await screen.findByRole('button', { name: 'Show' })).toBeInTheDocument();
    expect(screen.queryByTestId('recommendations-skeleton')).not.toBeInTheDocument();
    expect(mockUseSolutionState).toHaveBeenLastCalledWith(false);
    expect(mockGet).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: /Enable/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show' }));

    expect(mockUseSolutionState).toHaveBeenCalledWith(true);
    expect(await screen.findByRole('link', { name: /Enable Hosted Traces/ })).toBeInTheDocument();
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
  });

  it('navigates recommendations with previous/next buttons', async () => {
    const { user } = render(<Recommendations />);

    const region = await carouselRegion();
    const getVisibleHeading = () =>
      within(region)
        .getAllByRole('heading', { level: 3, hidden: true })
        .find((heading) => heading.closest('div[aria-hidden="false"]'));
    const getVisibleTitle = () => getVisibleHeading()?.textContent?.trim() ?? '';

    await screen.findByRole('button', { name: 'Next' });

    expect(getVisibleTitle()).toBe('Trace requests across services');

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(getVisibleTitle()).toBe('Monitor your Kubernetes fleet');

    await user.click(screen.getByRole('button', { name: 'Previous' }));

    expect(getVisibleTitle()).toBe('Trace requests across services');
  });

  it('navigates recommendations with dots', async () => {
    const { user } = render(<Recommendations />);

    expect(await screen.findByRole('button', { name: 'Go to recommendation 2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go to recommendation 1' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Go to recommendation 2' }));

    expect(screen.getByRole('button', { name: 'Go to recommendation 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go to recommendation 2' })).not.toBeInTheDocument();
  });

  it('pauses by default when reduced motion is preferred', async () => {
    const matchMediaSpy = jest.spyOn(window, 'matchMedia').mockImplementation(
      () =>
        ({
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          matches: true,
        }) as unknown as MediaQueryList
    );

    try {
      render(<Recommendations />);

      // findBy flushes the RecommendationExisting overview fetch inside act before asserting.
      expect(await screen.findByRole('button', { name: 'Resume' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
    } finally {
      matchMediaSpy.mockRestore();
    }
  });

  it('auto-advances a multi-card carousel and pauses on demand', async () => {
    jest.useFakeTimers();

    try {
      render(<Recommendations />);
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const pauseButton = await screen.findByRole('button', { name: 'Pause' });
      await user.click(pauseButton);

      expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(6000);
      });

      expect(screen.queryByRole('button', { name: 'Go to recommendation 1' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Resume' }));

      expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(6000);
      });

      expect(screen.getByRole('button', { name: 'Go to recommendation 1' })).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('announces the recommendation slides as a carousel region', async () => {
    render(<Recommendations />);

    const region = await carouselRegion();
    expect(region).toHaveAttribute('aria-roledescription', 'carousel');
  });

  describe('analytics', () => {
    // LinkButton renders a plain <a href>; clicking it would trigger a real jsdom
    // navigation (console.error -> jest-fail-on-console). Route anchor clicks through
    // the SPA history the way the app does so the onClick fires without navigating.
    beforeEach(() => {
      document.addEventListener('click', interceptLinkClicks);
    });

    afterEach(() => {
      document.removeEventListener('click', interceptLinkClicks);
    });

    it('tracks enable with the driving matrix row from the active card', async () => {
      const { user } = render(<Recommendations />);

      await user.click(await screen.findByRole('link', { name: /Enable Hosted Traces/ }));

      expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
        surface: 'recommendations',
        action: 'enable',
        placement: 'card',
        recommendation_id: 'hosted-traces',
        starting_state: 'ml_no_traces',
      });
    });

    it('tracks setup from an enabled-but-silent app card', async () => {
      mockGet.mockResolvedValue(APP_IDS.map((id) => listItem(id, { enabled: id === 'grafana-exploretraces-app' })));

      const { user } = render(<Recommendations />);

      await user.click(await screen.findByRole('link', { name: /Set up Hosted Traces/ }));

      expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
        surface: 'recommendations',
        action: 'setup',
        placement: 'card',
        recommendation_id: 'hosted-traces',
        starting_state: 'ml_no_traces',
      });
    });

    it('tracks the active solution view on card clicks once a solution is selected', async () => {
      setSolutionState(
        { metrics: 'active', logs: 'active' },
        { prometheus: prometheusDatasource, loki: lokiDatasource }
      );
      mockFetchMetricsActivity.mockResolvedValue({
        series: 4_200_000,
        names: null,
        hosts: null,
        seriesSparkline: null,
        disk: null,
      });
      mockFetchLogsActivity.mockResolvedValue({ bytes: 47_000_000_000, sources: 8, series: null });

      const { user } = render(<Recommendations />);

      // Once the default (metrics) selection settles, its leading card is K8s Monitoring.
      expect(await screen.findByRole('heading', { name: 'Metrics & infrastructure' })).toBeInTheDocument();
      await user.click(await screen.findByRole('link', { name: /Enable Kubernetes Monitoring/ }));

      expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
        surface: 'recommendations',
        action: 'enable',
        placement: 'card',
        recommendation_id: 'kubernetes-monitoring',
        starting_state: 'ml_no_traces',
        solution: 'metrics',
      });
    });

    it('tracks enable from a pill when the section is collapsed', async () => {
      const { user } = render(<Recommendations />);

      // Pills only exist for in-session collapses: a stored preference gates the probes off.
      await screen.findByRole('link', { name: /Enable Hosted Traces/ });
      await user.click(screen.getByRole('button', { name: 'Hide' }));

      await user.click(await screen.findByRole('link', { name: /Enable Hosted Traces/ }));

      expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
        surface: 'recommendations',
        action: 'enable',
        placement: 'pill',
        recommendation_id: 'hosted-traces',
        starting_state: 'ml_no_traces',
      });
    });
  });
});
