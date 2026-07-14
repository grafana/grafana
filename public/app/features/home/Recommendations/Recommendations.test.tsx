import { act, render, screen, userEvent, waitFor } from 'test/test-utils';

import { type PluginMeta } from '@grafana/data';
import { getPluginSettings } from '@grafana/runtime/unstable';
import { contextSrv } from 'app/core/services/context_srv';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { AccessControlAction } from 'app/types/accessControl';

import { Recommendations } from './Recommendations';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getPluginSettings: jest.fn(),
}));

jest.mock('app/features/alerting/unified/hooks/usePluginBridge', () => ({
  ...jest.requireActual('app/features/alerting/unified/hooks/usePluginBridge'),
  usePluginBridge: jest.fn(),
}));

// The RecommendationExisting child fetches its overview from Prometheus; resolve to an empty
// cluster so tests exercise the (deterministic) stub entries instead of hitting a datasource.
jest.mock('./kubernetesData', () => ({
  ...jest.requireActual('./kubernetesData'),
  fetchKubernetesOverview: jest.fn().mockResolvedValue({
    clusters: 0,
    pods: 0,
    alertsFiring: null,
    unhealthyPods: null,
    restarts1h: null,
    notReadyNodes: null,
  }),
  fetchClusterCpuSeries: jest.fn().mockResolvedValue(null),
}));

const mockUsePluginBridge = jest.mocked(usePluginBridge);
const mockGetPluginSettings = jest.mocked(getPluginSettings);

beforeEach(() => {
  window.localStorage.clear();
  mockUsePluginBridge.mockReturnValue({ loading: false, installed: true });
  // All recommended apps installed-but-disabled by default → every recommendation shows.
  mockGetPluginSettings.mockResolvedValue({ enabled: false } as PluginMeta);
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
});

afterEach(() => jest.restoreAllMocks());

describe('Recommendations', () => {
  it('renders nothing while plugin data is loading', async () => {
    mockUsePluginBridge.mockReturnValue({ loading: true });

    const { container } = render(<Recommendations />);

    // waitFor flushes the enabled-lookup state update inside act; the gate must keep rendering null.
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('renders nothing when Kubernetes Monitoring is not installed', async () => {
    mockUsePluginBridge.mockReturnValue({ loading: false, installed: false });

    const { container } = render(<Recommendations />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('renders nothing when the user cannot manage plugins', async () => {
    jest.mocked(contextSrv.hasPermission).mockReturnValue(false);
    jest.spyOn(contextSrv, 'hasRole').mockReturnValue(false);

    const { container } = render(<Recommendations />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('drops recommendations whose app is already enabled', async () => {
    mockGetPluginSettings.mockImplementation(async (id) => {
      const enabled = id === 'grafana-exploretraces-app' || id === 'grafana-synthetic-monitoring-app';
      return { enabled } as PluginMeta;
    });

    render(<Recommendations />);

    // findBy flushes the enabled lookup and the RecommendationExisting overview fetch inside act.
    expect(await screen.findByRole('link', { name: /Enable Application Observability/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Enable Hosted Traces/ })).not.toBeInTheDocument();
  });

  it('shows installed-but-disabled cards but hides not-installed cards for a write-only user', async () => {
    jest.mocked(contextSrv.hasPermission).mockImplementation((action) => action === AccessControlAction.PluginsWrite);
    jest.spyOn(contextSrv, 'hasRole').mockReturnValue(false);
    mockGetPluginSettings.mockImplementation(async (id) => {
      if (id === 'grafana-exploretraces-app') {
        throw Object.assign(new Error('Plugin not found'), { cause: { status: 404, data: {} } });
      }
      return { enabled: false } as PluginMeta;
    });

    render(<Recommendations />);

    // Await the section (classification resolves async) before asserting card presence/absence.
    await screen.findByText('Recommendations for your stack');
    // Cards past the active one are aria-hidden in the carousel, so query with { hidden: true }.
    expect(screen.queryByRole('link', { name: /Add Synthetic Monitoring/, hidden: true })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Enable Hosted Traces/, hidden: true })).not.toBeInTheDocument();
  });

  it('shows not-installed cards but hides installed-but-disabled cards for an install-only user', async () => {
    jest.mocked(contextSrv.hasPermission).mockImplementation((action) => action === AccessControlAction.PluginsInstall);
    jest.spyOn(contextSrv, 'hasRole').mockReturnValue(false);
    mockGetPluginSettings.mockImplementation(async (id) => {
      if (id === 'grafana-exploretraces-app') {
        throw Object.assign(new Error('Plugin not found'), { cause: { status: 404, data: {} } });
      }
      return { enabled: false } as PluginMeta;
    });

    render(<Recommendations />);

    await screen.findByText('Recommendations for your stack');
    expect(screen.queryByRole('link', { name: /Enable Hosted Traces/, hidden: true })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Add Synthetic Monitoring/, hidden: true })).not.toBeInTheDocument();
  });

  it('keeps a card whose settings lookup fails with a non-404 error', async () => {
    jest.spyOn(contextSrv, 'hasRole').mockReturnValue(false);
    mockGetPluginSettings.mockImplementation(async (id) => {
      if (id === 'grafana-exploretraces-app') {
        throw Object.assign(new Error('boom'), { cause: { status: 500, data: {} } });
      }
      return { enabled: false } as PluginMeta;
    });

    render(<Recommendations />);

    // 'unknown' (non-404 lookup failure) keeps the card rather than hiding it.
    expect(await screen.findByRole('link', { name: /Enable Hosted Traces/, hidden: true })).toBeInTheDocument();
  });

  it('renders every actionable card for a legacy Admin with no explicit plugin permissions', async () => {
    jest.mocked(contextSrv.hasPermission).mockReturnValue(false);
    jest.spyOn(contextSrv, 'hasRole').mockImplementation((role) => role === 'Admin');

    render(<Recommendations />);

    await screen.findByText('Recommendations for your stack');
    expect(screen.getByRole('link', { name: /Enable Hosted Traces/, hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Add Synthetic Monitoring/, hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Enable Application Observability/, hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Enable Frontend Observability/, hidden: true })).toBeInTheDocument();
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
});
