import { type DataSourceInstanceListItem, type FieldSparkline } from '@grafana/data';

import {
  fetchAppObservabilityRequestSeries,
  fetchAppObservabilityStats,
  probeSpanMetrics,
} from './appObservabilityData';
import { appObservabilitySolution } from './appObservabilitySolution';
import { pluginAvailability, setupGuideEnabled } from './pluginAvailability';
import { accessibleAppPage, drilldownActiveCta } from './pluginPages';

jest.mock('./appObservabilityData', () => ({
  ...jest.requireActual('./appObservabilityData'),
  fetchAppObservabilityRequestSeries: jest.fn(),
  fetchAppObservabilityStats: jest.fn(),
  probeSpanMetrics: jest.fn(),
}));

jest.mock('./pluginAvailability', () => ({
  pluginAvailability: jest.fn(),
  setupGuideEnabled: jest.fn(),
}));

jest.mock('./pluginPages', () => ({
  ...jest.requireActual('./pluginPages'),
  accessibleAppPage: jest.fn(),
  drilldownActiveCta: jest.fn(),
}));

const mockFetchStats = jest.mocked(fetchAppObservabilityStats);
const mockFetchSeries = jest.mocked(fetchAppObservabilityRequestSeries);
const mockProbe = jest.mocked(probeSpanMetrics);
const mockPluginAvailability = jest.mocked(pluginAvailability);
const mockSetupGuideEnabled = jest.mocked(setupGuideEnabled);
const mockAccessibleAppPage = jest.mocked(accessibleAppPage);
const mockDrilldownActiveCta = jest.mocked(drilldownActiveCta);

const datasource = { uid: 'prom-uid', name: 'grafanacloud-prom', type: 'prometheus' } as DataSourceInstanceListItem;

beforeEach(() => {
  mockFetchStats.mockReset();
  mockFetchStats.mockResolvedValue({ services: 12, errorRatio: 0.004 });
  mockFetchSeries.mockReset();
  mockFetchSeries.mockResolvedValue(null);
  mockProbe.mockReset();
  mockProbe.mockResolvedValue(datasource);
  mockPluginAvailability.mockReset();
  mockPluginAvailability.mockResolvedValue(new Map([['grafana-app-observability-app', { state: 'setup' }]]));
  mockSetupGuideEnabled.mockReset();
  mockSetupGuideEnabled.mockResolvedValue(false);
  mockAccessibleAppPage.mockReset();
  mockAccessibleAppPage.mockImplementation(async (appId, path) => `/a/${appId}${path}`);
  mockDrilldownActiveCta.mockReset();
  mockDrilldownActiveCta.mockResolvedValue({
    label: 'Open Application Observability',
    href: '/a/grafana-app-observability-app/services',
    action: 'open_solution',
  });
});

describe('appObservabilitySolution', () => {
  it('constructs an inert solution with its identity available synchronously', () => {
    const solution = appObservabilitySolution();

    expect(solution).toMatchObject({
      id: 'app-observability',
      icon: 'application-observability',
      title: 'Application Observability',
    });
    expect(mockProbe).not.toHaveBeenCalled();
    expect(mockFetchStats).not.toHaveBeenCalled();
    expect(mockFetchSeries).not.toHaveBeenCalled();
    expect(mockPluginAvailability).not.toHaveBeenCalled();
  });

  it('shares one span-metrics detection between signal and datasource readers', async () => {
    const solution = appObservabilitySolution();

    await expect(solution.signal()).resolves.toBe('active');
    await expect(solution.datasource()).resolves.toBe(datasource);
    await expect(solution.signal()).resolves.toBe('active');
    expect(mockProbe).toHaveBeenCalledTimes(1);
  });

  it('reports inactive with no datasource after a definitive empty result', async () => {
    mockProbe.mockResolvedValue(null);
    const solution = appObservabilitySolution();

    await expect(solution.signal()).resolves.toBe('inactive');
    await expect(solution.datasource()).resolves.toBeNull();
  });

  it('degrades a failed detection to unknown without starting detail queries', async () => {
    mockProbe.mockRejectedValue(new Error('datasource list failed'));
    const solution = appObservabilitySolution();

    await expect(solution.signal()).resolves.toBe('unknown');
    await expect(solution.datasource()).resolves.toBeNull();
    await expect(solution.stats()).resolves.toBeNull();
    await expect(solution.sparkline()).resolves.toBeNull();
    await expect(solution.cta()).resolves.toBeNull();
    expect(mockProbe).toHaveBeenCalledTimes(1);
    expect(mockFetchStats).not.toHaveBeenCalled();
    expect(mockFetchSeries).not.toHaveBeenCalled();
  });

  it('queries each detail once with the datasource that proved span metrics', async () => {
    const series = { x: { values: [1] }, y: { values: [2] } } as unknown as FieldSparkline;
    mockFetchSeries.mockResolvedValue(series);
    const solution = appObservabilitySolution();

    await Promise.all([solution.stats(), solution.stats(), solution.sparkline(), solution.sparkline()]);

    expect(mockProbe).toHaveBeenCalledTimes(1);
    expect(mockFetchStats).toHaveBeenCalledTimes(1);
    expect(mockFetchStats).toHaveBeenCalledWith(datasource);
    expect(mockFetchSeries).toHaveBeenCalledTimes(1);
    expect(mockFetchSeries).toHaveBeenCalledWith(datasource);
  });

  it('never needs attention and has no alert or refined stats even with data flowing', async () => {
    const solution = appObservabilitySolution();

    await expect(solution.needsAttention()).resolves.toBe(false);
    await expect(solution.alert()).resolves.toBeNull();
    await expect(solution.refinedStats()).resolves.toBeNull();
  });
});

describe('appObservabilitySolution stats and sparkline', () => {
  it('formats the service count with the error-ratio secondary', async () => {
    await expect(appObservabilitySolution().stats()).resolves.toEqual({
      primary: '12 services',
      secondary: '0.4% errors · 24h',
    });
    expect(mockFetchStats).toHaveBeenCalledWith(datasource);
  });

  it('renders an error-free fleet as zero errors without a trailing decimal', async () => {
    mockFetchStats.mockResolvedValue({ services: 2, errorRatio: 0 });

    await expect(appObservabilitySolution().stats()).resolves.toEqual({
      primary: '2 services',
      secondary: '0% errors · 24h',
    });
  });

  it('omits stats without a service count', async () => {
    mockFetchStats.mockResolvedValue({ services: null, errorRatio: 0.2 });
    await expect(appObservabilitySolution().stats()).resolves.toBeNull();

    mockFetchStats.mockResolvedValue({ services: 0, errorRatio: 0.2 });
    await expect(appObservabilitySolution().stats()).resolves.toBeNull();
  });

  it('drops the secondary when the error ratio is unavailable', async () => {
    mockFetchStats.mockResolvedValue({ services: 3, errorRatio: null });

    await expect(appObservabilitySolution().stats()).resolves.toEqual({ primary: '3 services' });
  });

  it('returns the request trend with its 24-hour caption', async () => {
    const series = { x: { values: [1] }, y: { values: [2] } } as unknown as FieldSparkline;
    mockFetchSeries.mockResolvedValue(series);

    await expect(appObservabilitySolution().sparkline()).resolves.toEqual({
      series,
      caption: 'Request rate · last 24h',
    });
    expect(mockFetchSeries).toHaveBeenCalledWith(datasource);
  });

  it('omits the sparkline when the span metrics are unavailable', async () => {
    await expect(appObservabilitySolution().sparkline()).resolves.toBeNull();
  });
});

describe('appObservabilitySolution CTA and offer', () => {
  it('builds the active CTA to the service inventory from the proving datasource', async () => {
    await expect(appObservabilitySolution().cta()).resolves.toEqual({
      label: 'Open Application Observability',
      href: '/a/grafana-app-observability-app/services',
      action: 'open_solution',
    });
    expect(mockDrilldownActiveCta).toHaveBeenCalledWith(
      datasource,
      'grafana-app-observability-app',
      'Application Observability',
      '/a/grafana-app-observability-app/services'
    );
  });

  it('has no CTA without a datasource carrying span metrics', async () => {
    mockProbe.mockResolvedValue(null);

    await expect(appObservabilitySolution().cta()).resolves.toBeNull();
    expect(mockDrilldownActiveCta).not.toHaveBeenCalled();
  });

  it('never loads plugin availability for an active solution', async () => {
    await expect(appObservabilitySolution().offer()).resolves.toBeNull();
    expect(mockPluginAvailability).not.toHaveBeenCalled();
    expect(mockSetupGuideEnabled).not.toHaveBeenCalled();
  });

  it('offers enabling the disabled app after a definitive no-data result', async () => {
    mockProbe.mockResolvedValue(null);
    mockPluginAvailability.mockResolvedValue(
      new Map([['grafana-app-observability-app', { state: 'enable' as const, canEnable: true }]])
    );

    await expect(appObservabilitySolution().offer()).resolves.toEqual({
      availability: 'enable',
      description: 'Turn OpenTelemetry data into RED metrics, service maps, and correlated traces.',
      cta: { label: 'Enable', href: '/plugins/grafana-app-observability-app/', action: 'enable' },
      learnMore: {
        href: 'https://grafana.com/docs/grafana-cloud/observe-and-act/monitor-applications/application-observability/',
      },
    });
  });

  it('offers the accessible landing-page setup flow after a definitive no-data result', async () => {
    mockProbe.mockResolvedValue(null);

    await expect(appObservabilitySolution().offer()).resolves.toEqual({
      availability: 'setup',
      description: 'Turn OpenTelemetry data into RED metrics, service maps, and correlated traces.',
      setupHint: 'requires instrumentation',
      cta: {
        label: 'Set up Application Observability',
        href: '/a/grafana-app-observability-app/landing',
        action: 'setup',
      },
      learnMore: {
        href: 'https://grafana.com/docs/grafana-cloud/observe-and-act/monitor-applications/application-observability/',
      },
    });
    expect(mockAccessibleAppPage).toHaveBeenCalledWith('grafana-app-observability-app', '/landing');
  });

  it('keeps the offer without a CTA when the landing page is inaccessible', async () => {
    mockProbe.mockResolvedValue(null);
    mockAccessibleAppPage.mockResolvedValue(null);

    await expect(appObservabilitySolution().offer()).resolves.toEqual({
      availability: 'setup',
      description: 'Turn OpenTelemetry data into RED metrics, service maps, and correlated traces.',
      setupHint: 'requires instrumentation',
      cta: null,
      learnMore: {
        href: 'https://grafana.com/docs/grafana-cloud/observe-and-act/monitor-applications/application-observability/',
      },
    });
  });
});
