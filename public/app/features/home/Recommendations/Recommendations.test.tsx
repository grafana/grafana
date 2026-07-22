import { act, render, screen, userEvent, waitFor } from 'test/test-utils';

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
import { hasSolutionData } from './solutionDataProbes';

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

// Enabled solutions report data by default so the pre-probe expectations (enabled -> hidden)
// keep holding; individual tests flip specific solutions to the no-data state.
jest.mock('./solutionDataProbes', () => ({
  hasSolutionData: jest.fn().mockResolvedValue(true),
}));

const APP_IDS = [
  'grafana-exploretraces-app',
  'grafana-synthetic-monitoring-app',
  'grafana-app-observability-app',
  'grafana-kowalski-app',
];
const listItem = (id: string, overrides: Partial<LocalPlugin> = {}) => ({
  id,
  enabled: false,
  accessControl: { [AccessControlAction.PluginsWrite]: true, [AccessControlAction.PluginsAppAccess]: true },
  ...overrides,
});

const mockUsePluginBridge = jest.mocked(usePluginBridge);

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
  jest.mocked(hasSolutionData).mockReset();
  jest.mocked(hasSolutionData).mockResolvedValue(true);
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
});

afterEach(() => jest.restoreAllMocks());

describe('Recommendations', () => {
  it('renders nothing while plugin data is loading', async () => {
    mockUsePluginBridge.mockReturnValue({ loading: true });

    const { container } = render(<Recommendations />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('renders the section even when Kubernetes Monitoring is not installed', async () => {
    mockUsePluginBridge.mockReturnValue({ loading: false, installed: false });

    render(<Recommendations />);

    expect(await screen.findByText('Recommendations for your stack')).toBeInTheDocument();
  });

  it('shows the no-data card when no datasource has Kubernetes data', async () => {
    render(<Recommendations />);

    expect(await screen.findByRole('heading', { name: 'No data flowing yet' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Kubernetes Monitoring' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Hosted Metrics' })).not.toBeInTheDocument();
  });

  it('renders nothing when the user cannot manage plugins', async () => {
    jest.mocked(contextSrv.hasPermission).mockReturnValue(false);

    const { container } = render(<Recommendations />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockUsePluginBridge).not.toHaveBeenCalled();
  });

  it('drops recommendations whose app is already enabled and receiving data', async () => {
    mockGet.mockResolvedValue(
      APP_IDS.map((id) =>
        listItem(id, {
          enabled: id === 'grafana-exploretraces-app' || id === 'grafana-synthetic-monitoring-app',
        })
      )
    );

    render(<Recommendations />);

    expect(await screen.findByRole('link', { name: /Enable Application Observability/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Enable Hosted Traces/ })).not.toBeInTheDocument();
  });

  it('keeps recommending an enabled app that has no data, with a setup CTA into the app', async () => {
    jest
      .mocked(hasSolutionData)
      .mockImplementation(async (pluginId: string) => pluginId !== 'grafana-synthetic-monitoring-app');
    mockGet.mockResolvedValue(APP_IDS.map((id) => listItem(id, { enabled: true })));

    render(<Recommendations />);

    const setupLink = await screen.findByRole('link', { name: /Set up Synthetic Monitoring/, hidden: true });
    expect(setupLink).toHaveAttribute('href', '/a/grafana-synthetic-monitoring-app');
    expect(screen.queryByRole('link', { name: /Enable Hosted Traces/, hidden: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Add Synthetic Monitoring/, hidden: true })).not.toBeInTheDocument();
  });

  it('hides the section when every enabled app has data', async () => {
    mockGet.mockResolvedValue(APP_IDS.map((id) => listItem(id, { enabled: true })));

    const { container } = render(<Recommendations />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('hides the setup card when the user lacks app access to the silent app', async () => {
    jest.mocked(hasSolutionData).mockResolvedValue(false);
    mockGet.mockResolvedValue(
      APP_IDS.map((id) =>
        listItem(id, {
          enabled: true,
          accessControl:
            id === 'grafana-synthetic-monitoring-app'
              ? { [AccessControlAction.PluginsWrite]: true }
              : { [AccessControlAction.PluginsWrite]: true, [AccessControlAction.PluginsAppAccess]: true },
        })
      )
    );

    render(<Recommendations />);

    expect(await screen.findByRole('link', { name: /Set up Hosted Traces/, hidden: true })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Set up Synthetic Monitoring/, hidden: true })).not.toBeInTheDocument();
  });

  it('shows installed-but-disabled cards but hides not-installed cards for a write-only user', async () => {
    jest.mocked(contextSrv.hasPermission).mockImplementation((action) => action === AccessControlAction.PluginsWrite);
    mockGet.mockResolvedValue(APP_IDS.filter((id) => id !== 'grafana-exploretraces-app').map((id) => listItem(id)));

    render(<Recommendations />);

    await screen.findByText('Recommendations for your stack');
    // Cards past the active one are aria-hidden in the carousel, so query with { hidden: true }.
    expect(screen.queryByRole('link', { name: /Add Synthetic Monitoring/, hidden: true })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Enable Hosted Traces/, hidden: true })).not.toBeInTheDocument();
  });

  it('shows not-installed cards but hides installed-but-disabled cards for an install-only user', async () => {
    jest.mocked(contextSrv.hasPermission).mockImplementation((action) => action === AccessControlAction.PluginsInstall);
    mockGet.mockResolvedValue(
      APP_IDS.filter((id) => id !== 'grafana-exploretraces-app').map((id) => listItem(id, { accessControl: {} }))
    );

    render(<Recommendations />);

    await screen.findByText('Recommendations for your stack');
    expect(screen.queryByRole('link', { name: /Enable Hosted Traces/, hidden: true })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Add Synthetic Monitoring/, hidden: true })).not.toBeInTheDocument();
  });

  it('hides the section when the plugin list cannot be fetched', async () => {
    mockGet.mockRejectedValue(new Error('boom'));

    const { container } = render(<Recommendations />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('renders nothing when the plugin list is empty', async () => {
    mockGet.mockResolvedValue([]);

    const { container } = render(<Recommendations />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('renders nothing for legacy Admin roles without plugin permissions', async () => {
    jest.mocked(contextSrv.hasPermission).mockReturnValue(false);
    jest.spyOn(contextSrv, 'hasRole').mockImplementation((role) => role === 'Admin');

    const { container } = render(<Recommendations />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('only shows disabled cards the user can write', async () => {
    jest.mocked(contextSrv.hasPermission).mockImplementation((action) => action === AccessControlAction.PluginsWrite);
    mockGet.mockResolvedValue(
      APP_IDS.map((id) =>
        listItem(id, {
          accessControl: id === 'grafana-exploretraces-app' ? { [AccessControlAction.PluginsWrite]: true } : {},
        })
      )
    );

    render(<Recommendations />);

    expect(await screen.findByRole('link', { name: /Enable Hosted Traces/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Add Synthetic Monitoring/ })).not.toBeInTheDocument();
  });

  it('hides install cards when plugin admin is disabled', async () => {
    config.pluginAdminEnabled = false;
    jest.mocked(contextSrv.hasPermission).mockImplementation((action) => action === AccessControlAction.PluginsInstall);
    mockGet.mockResolvedValue(
      APP_IDS.filter((id) => id !== 'grafana-exploretraces-app').map((id) => listItem(id, { accessControl: {} }))
    );

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

  it('loads the collapsed state from local storage', async () => {
    window.localStorage.setItem('grafana.home.recommendations.collapsed', 'true');
    render(<Recommendations />);

    expect(await screen.findByRole('button', { name: 'Show' })).toBeInTheDocument();
    expect(screen.getByText('Recommendations for your stack')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('navigates recommendations with previous/next buttons', async () => {
    const { user } = render(<Recommendations />);

    const getVisibleHeading = () =>
      screen.getAllByRole('heading', { level: 3 }).find((heading) => heading.closest('div[aria-hidden="false"]'));
    const getVisibleTitle = () => getVisibleHeading()?.textContent?.trim() ?? '';
    const getVisibleSlide = () => getVisibleHeading()?.closest('div[aria-hidden="false"]');

    // The enabled lookup resolves async; wait for the carousel before reading slides.
    await screen.findByRole('button', { name: 'Next' });

    const initialVisibleSlide = getVisibleSlide();
    const initialVisibleTitle = getVisibleTitle();

    expect(initialVisibleSlide).toBeInTheDocument();
    expect(getVisibleHeading()).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(getVisibleSlide()).toBeInTheDocument();
    expect(getVisibleSlide()).not.toBe(initialVisibleSlide);
    expect(getVisibleTitle()).not.toBe(initialVisibleTitle);
    expect(getVisibleHeading()).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Previous' }));

    expect(getVisibleSlide()).toBe(initialVisibleSlide);
    expect(getVisibleTitle()).toBe(initialVisibleTitle);
    expect(getVisibleHeading()).toBeInTheDocument();
  });

  it('navigates recommendations with dots', async () => {
    const { user } = render(<Recommendations />);

    expect(await screen.findByRole('button', { name: 'Go to recommendation 2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go to recommendation 1' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to recommendation 3' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Go to recommendation 3' }));

    expect(screen.getByRole('button', { name: 'Go to recommendation 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to recommendation 2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go to recommendation 3' })).not.toBeInTheDocument();
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

  it('pauses and resumes autoplay', async () => {
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

    const region = await screen.findByRole('region', { name: 'Recommended apps' });
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

    it('tracks enable from the active recommendation card', async () => {
      const { user } = render(<Recommendations />);

      await user.click(await screen.findByRole('link', { name: /Enable Hosted Traces/ }));

      expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
        surface: 'recommendations',
        action: 'enable',
        placement: 'card',
        recommendation_id: 'hosted-traces',
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
      });
    });
  });
});
