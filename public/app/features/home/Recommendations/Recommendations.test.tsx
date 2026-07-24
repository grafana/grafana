import { act, render, screen, userEvent, waitFor, within } from 'test/test-utils';

import { type PluginMeta } from '@grafana/data';
import { config } from '@grafana/runtime';
import { interceptLinkClicks } from 'app/core/navigation/patch/interceptLinkClicks';
import { contextSrv } from 'app/core/services/context_srv';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { type LocalPlugin } from 'app/features/plugins/admin/types';
import { AccessControlAction } from 'app/types/accessControl';

import { ctaClicked } from '../analytics/main';

import { Recommendations } from './Recommendations';
import {
  fetchClusterCpuSeries,
  fetchKubernetesHealth,
  fetchKubernetesInventory,
  resolveKubernetesDatasource,
} from './kubernetesData';
import { useSolutionState } from './solutionState';
import { type SolutionState } from './solutionsMatrix';

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

const LEGACY_APP_IDS = ['grafana-synthetic-monitoring-app', 'grafana-app-observability-app', 'grafana-kowalski-app'];
const APP_IDS = ['grafana-exploretraces-app', 'grafana-k8s-app', ...LEGACY_APP_IDS];

const listItem = (id: string, overrides: Partial<LocalPlugin> = {}) => ({
  id,
  enabled: false,
  accessControl: { [AccessControlAction.PluginsWrite]: true, [AccessControlAction.PluginsAppAccess]: true },
  ...overrides,
});

const mockUsePluginBridge = jest.mocked(usePluginBridge);
const mockUseSolutionState = jest.mocked(useSolutionState);

function setSolutionState(overrides: Partial<SolutionState>) {
  mockUseSolutionState.mockReturnValue({
    value: {
      state: { metrics: 'inactive', logs: 'inactive', traces: 'inactive', kubernetes: 'inactive', ...overrides },
      lokiDatasource: null,
      tempoDatasource: null,
    },
    loading: false,
  });
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
  // Metrics + Logs, no Traces: the two-card row (hosted-traces, kubernetes-monitoring).
  setSolutionState({ metrics: 'active', logs: 'active' });
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
});

afterEach(() => jest.restoreAllMocks());

const carouselRegion = async () => screen.findByRole('region', { name: 'Recommended apps' });

describe('Recommendations', () => {
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

  it('shows a skeleton while the solution state is resolving', async () => {
    mockUseSolutionState.mockReturnValue({ value: undefined, loading: true });

    render(<Recommendations />);

    expect(await screen.findByTestId('recommendations-skeleton')).toBeInTheDocument();
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

  it('hides connection cards without datasource creation permission', async () => {
    setSolutionState({ metrics: 'active' });
    jest
      .mocked(contextSrv.hasPermission)
      .mockImplementation((action) => action !== AccessControlAction.DataSourcesCreate);

    render(<Recommendations />);

    await screen.findByText('Recommendations for your stack');
    expect(screen.queryByRole('link', { name: /Add Logs/, hidden: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Recommended apps' })).not.toBeInTheDocument();
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

    // Same failure with a plugin-card selection: nothing renders but the region stays.
    setSolutionState({ metrics: 'active', logs: 'active' });
    render(<Recommendations />);

    expect(await screen.findByText('Recommendations for your stack')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Hosted Traces/, hidden: true })).not.toBeInTheDocument();
  });

  it('fails plugin cards closed when the plugin list is empty', async () => {
    mockGet.mockResolvedValue([]);

    render(<Recommendations />);

    await screen.findByText('Recommendations for your stack');
    expect(screen.queryByRole('region', { name: 'Recommended apps' })).not.toBeInTheDocument();
  });

  it('renders the region left-only when any signal is unknown', async () => {
    setSolutionState({ metrics: 'active', logs: 'unknown' });

    render(<Recommendations />);

    await screen.findByText('Recommendations for your stack');
    expect(await screen.findByRole('heading', { name: 'No data flowing yet' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Recommended apps' })).not.toBeInTheDocument();
  });

  it('renders the region left-only with no pills for fully active stacks', async () => {
    setSolutionState({ metrics: 'active', logs: 'active', traces: 'active', kubernetes: 'active' });

    const { user } = render(<Recommendations />);

    await screen.findByText('Recommendations for your stack');
    expect(screen.queryByRole('region', { name: 'Recommended apps' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide' }));

    // Collapsed with zero recommendations: no pill row either.
    expect(screen.queryByRole('link', { name: /Enable/ })).not.toBeInTheDocument();
  });

  it('never renders the removed legacy cards, even installed and disabled', async () => {
    render(<Recommendations />);

    const region = await carouselRegion();
    expect(within(region).queryByRole('link', { name: /Synthetic Monitoring/, hidden: true })).not.toBeInTheDocument();
    expect(
      within(region).queryByRole('link', { name: /Application Observability/, hidden: true })
    ).not.toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: 'Hide' }));
    await screen.findByRole('button', { name: 'Show' });
    await user.click(screen.getByRole('button', { name: 'Show' }));
    expect(mockResolve).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('recommendation-existing-skeleton')).not.toBeInTheDocument();
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

    it('tracks enable from a pill when the section is collapsed', async () => {
      window.localStorage.setItem('grafana.home.recommendations.collapsed', 'true');

      const { user } = render(<Recommendations />);

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
