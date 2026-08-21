import { type DataSourceInstanceListItem, type FieldSparkline } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';

import { pluginAvailability, setupGuideEnabled } from './pluginAvailability';
import { accessibleAppPage } from './pluginPages';
import {
  fetchSyntheticsHealth,
  fetchSyntheticsStats,
  fetchSyntheticsSuccessSeries,
  probeSyntheticChecks,
  type SyntheticsHealth,
} from './syntheticsData';
import { syntheticsSolution } from './syntheticsSolution';

jest.mock('./syntheticsData', () => ({
  ...jest.requireActual('./syntheticsData'),
  fetchSyntheticsHealth: jest.fn(),
  fetchSyntheticsStats: jest.fn(),
  fetchSyntheticsSuccessSeries: jest.fn(),
  probeSyntheticChecks: jest.fn(),
}));

jest.mock('./pluginAvailability', () => ({
  pluginAvailability: jest.fn(),
  setupGuideEnabled: jest.fn(),
}));

jest.mock('./pluginPages', () => ({
  ...jest.requireActual('./pluginPages'),
  accessibleAppPage: jest.fn(),
}));

const mockFetchHealth = jest.mocked(fetchSyntheticsHealth);
const mockFetchStats = jest.mocked(fetchSyntheticsStats);
const mockFetchSeries = jest.mocked(fetchSyntheticsSuccessSeries);
const mockProbe = jest.mocked(probeSyntheticChecks);
const mockPluginAvailability = jest.mocked(pluginAvailability);
const mockSetupGuideEnabled = jest.mocked(setupGuideEnabled);
const mockAccessibleAppPage = jest.mocked(accessibleAppPage);

const datasource = { uid: 'sm-uid', name: 'sm-prom', type: 'prometheus' } as DataSourceInstanceListItem;
const healthy: SyntheticsHealth = { failing: null, worstCheck: null, worstRatio: null };

beforeEach(() => {
  mockFetchHealth.mockReset();
  mockFetchHealth.mockResolvedValue(healthy);
  mockFetchStats.mockReset();
  mockFetchStats.mockResolvedValue({ checks: 12, successRatio: 0.985 });
  mockFetchSeries.mockReset();
  mockFetchSeries.mockResolvedValue(null);
  mockProbe.mockReset();
  mockProbe.mockResolvedValue(datasource);
  mockPluginAvailability.mockReset();
  mockPluginAvailability.mockResolvedValue(new Map([['grafana-synthetic-monitoring-app', { state: 'setup' }]]));
  mockSetupGuideEnabled.mockReset();
  mockSetupGuideEnabled.mockResolvedValue(false);
  mockAccessibleAppPage.mockReset();
  mockAccessibleAppPage.mockImplementation(async (appId, path) => `/a/${appId}${path}`);
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
});

afterEach(() => jest.restoreAllMocks());

describe('syntheticsSolution', () => {
  it('constructs an inert solution with its identity available synchronously', () => {
    const solution = syntheticsSolution();

    expect(solution).toMatchObject({ id: 'synthetics', icon: 'globe', title: 'Synthetic Monitoring' });
    expect(mockProbe).not.toHaveBeenCalled();
    expect(mockFetchHealth).not.toHaveBeenCalled();
    expect(mockFetchStats).not.toHaveBeenCalled();
    expect(mockFetchSeries).not.toHaveBeenCalled();
    expect(mockPluginAvailability).not.toHaveBeenCalled();
  });

  it('shares one active detection between signal and datasource readers', async () => {
    const solution = syntheticsSolution();

    await expect(solution.signal()).resolves.toBe('active');
    await expect(solution.datasource()).resolves.toBe(datasource);
    await expect(solution.signal()).resolves.toBe('active');
    expect(mockProbe).toHaveBeenCalledTimes(1);
  });

  it('reports inactive with no datasource after a definitive empty result', async () => {
    mockProbe.mockResolvedValue(null);
    const solution = syntheticsSolution();

    await expect(solution.signal()).resolves.toBe('inactive');
    await expect(solution.datasource()).resolves.toBeNull();
  });

  it('degrades a failed detection to unknown without starting detail queries', async () => {
    mockProbe.mockRejectedValue(new Error('datasource list failed'));
    const solution = syntheticsSolution();

    await expect(solution.signal()).resolves.toBe('unknown');
    await expect(solution.datasource()).resolves.toBeNull();
    await expect(solution.needsAttention()).resolves.toBe(false);
    await expect(solution.stats()).resolves.toBeNull();
    await expect(solution.alert()).resolves.toBeNull();
    await expect(solution.sparkline()).resolves.toBeNull();
    await expect(solution.cta()).resolves.toBeNull();
    expect(mockProbe).toHaveBeenCalledTimes(1);
    expect(mockFetchStats).not.toHaveBeenCalled();
    expect(mockFetchHealth).not.toHaveBeenCalled();
    expect(mockFetchSeries).not.toHaveBeenCalled();
  });

  it('queries each detail once with the datasource that proved Synthetics usage', async () => {
    const series = { x: { values: [1] }, y: { values: [2] } } as unknown as FieldSparkline;
    mockFetchSeries.mockResolvedValue(series);
    const solution = syntheticsSolution();

    await Promise.all([
      solution.stats(),
      solution.stats(),
      solution.needsAttention(),
      solution.needsAttention(),
      solution.alert(),
      solution.alert(),
      solution.sparkline(),
    ]);

    expect(mockProbe).toHaveBeenCalledTimes(1);
    expect(mockFetchStats).toHaveBeenCalledTimes(1);
    expect(mockFetchStats).toHaveBeenCalledWith(datasource);
    expect(mockFetchHealth).toHaveBeenCalledTimes(1);
    expect(mockFetchHealth).toHaveBeenCalledWith(datasource);
    expect(mockFetchSeries).toHaveBeenCalledTimes(1);
    expect(mockFetchSeries).toHaveBeenCalledWith(datasource);
  });
});

describe('syntheticsSolution alert', () => {
  it('returns no alert when no check is failing, without probing the app', async () => {
    const solution = syntheticsSolution();

    await expect(solution.needsAttention()).resolves.toBe(false);
    await expect(solution.alert()).resolves.toBeNull();
    expect(mockAccessibleAppPage).not.toHaveBeenCalled();
  });

  it('treats a zero failing count as healthy', async () => {
    mockFetchHealth.mockResolvedValue({ failing: 0, worstCheck: null, worstRatio: null });
    const solution = syntheticsSolution();

    await expect(solution.needsAttention()).resolves.toBe(false);
    await expect(solution.alert()).resolves.toBeNull();
  });

  it('reports failing checks with the worst offender as detail', async () => {
    mockFetchHealth.mockResolvedValue({ failing: 2, worstCheck: 'checkout-flow', worstRatio: 0.42 });
    const solution = syntheticsSolution();

    await expect(solution.needsAttention()).resolves.toBe(true);
    await expect(solution.alert()).resolves.toEqual({
      primary: '2 checks failing',
      details: ['checkout-flow at 42%'],
    });
    expect(mockFetchHealth).toHaveBeenCalledTimes(1);
    expect(mockFetchHealth).toHaveBeenCalledWith(datasource);
  });

  it('omits the detail row when the worst check is unidentified', async () => {
    mockFetchHealth.mockResolvedValue({ failing: 1, worstCheck: null, worstRatio: null });

    await expect(syntheticsSolution().alert()).resolves.toEqual({
      primary: '1 check failing',
      details: [],
    });
  });
});

describe('syntheticsSolution stats and sparkline', () => {
  it('formats the check count with the success-ratio secondary', async () => {
    await expect(syntheticsSolution().stats()).resolves.toEqual({
      primary: '12 checks',
      secondary: '98.5% success · 24h',
    });
    expect(mockFetchStats).toHaveBeenCalledWith(datasource);
  });

  it('renders a fully green fleet without a trailing decimal', async () => {
    mockFetchStats.mockResolvedValue({ checks: 2, successRatio: 1 });

    await expect(syntheticsSolution().stats()).resolves.toEqual({
      primary: '2 checks',
      secondary: '100% success · 24h',
    });
  });

  it('omits stats without a check count', async () => {
    mockFetchStats.mockResolvedValue({ checks: null, successRatio: 0.9 });
    await expect(syntheticsSolution().stats()).resolves.toBeNull();

    mockFetchStats.mockResolvedValue({ checks: 0, successRatio: 0.9 });
    await expect(syntheticsSolution().stats()).resolves.toBeNull();
  });

  it('drops the secondary when the success ratio is unavailable', async () => {
    mockFetchStats.mockResolvedValue({ checks: 3, successRatio: null });

    await expect(syntheticsSolution().stats()).resolves.toEqual({ primary: '3 checks' });
  });

  it('returns the success trend with its 24-hour caption', async () => {
    const series = { x: { values: [1] }, y: { values: [2] } } as unknown as FieldSparkline;
    mockFetchSeries.mockResolvedValue(series);

    await expect(syntheticsSolution().sparkline()).resolves.toEqual({
      series,
      caption: 'Success rate · last 24h',
    });
    expect(mockFetchSeries).toHaveBeenCalledWith(datasource);
  });

  it('omits the sparkline when the probe metrics are unavailable', async () => {
    await expect(syntheticsSolution().sparkline()).resolves.toBeNull();
  });
});

describe('syntheticsSolution CTA and offer', () => {
  it('opens the checks page when the solution needs attention', async () => {
    mockFetchHealth.mockResolvedValue({ failing: 2, worstCheck: 'checkout-flow', worstRatio: 0.42 });

    await expect(syntheticsSolution().cta()).resolves.toEqual({
      label: 'View failing checks',
      href: '/a/grafana-synthetic-monitoring-app/checks',
      action: 'view_alerts',
    });
    expect(mockAccessibleAppPage).toHaveBeenCalledWith('grafana-synthetic-monitoring-app', '/checks');
  });

  it('falls back to the app home when the checks page is inaccessible', async () => {
    mockFetchHealth.mockResolvedValue({ failing: 2, worstCheck: null, worstRatio: null });
    mockAccessibleAppPage.mockImplementation(async (appId, path) => (path === '/checks' ? null : `/a/${appId}${path}`));

    await expect(syntheticsSolution().cta()).resolves.toEqual({
      label: 'Open Synthetic Monitoring',
      href: '/a/grafana-synthetic-monitoring-app/home',
      action: 'open_solution',
    });
  });

  it('opens the app home when nothing needs attention', async () => {
    await expect(syntheticsSolution().cta()).resolves.toEqual({
      label: 'Open Synthetic Monitoring',
      href: '/a/grafana-synthetic-monitoring-app/home',
      action: 'open_solution',
    });
    expect(mockAccessibleAppPage).toHaveBeenCalledWith('grafana-synthetic-monitoring-app', '/home');
  });

  it('falls back to Explore using the proving datasource when the app is inaccessible', async () => {
    mockAccessibleAppPage.mockResolvedValue(null);

    const cta = await syntheticsSolution().cta();

    expect(cta?.label).toBe('Open in Explore');
    expect(cta?.href).toMatch(/^\/explore\?left=/);
    expect(cta?.action).toBe('open_solution');
    expect(decodeURIComponent(cta!.href)).toContain('sm-prom');
  });

  it('offers the accessible setup flow after a definitive no-data result', async () => {
    mockProbe.mockResolvedValue(null);

    await expect(syntheticsSolution().offer()).resolves.toEqual({
      availability: 'setup',
      description: 'Monitor uptime and performance of your endpoints from probes around the world.',
      setupHint: 'create a check',
      cta: {
        label: 'Create a check',
        href: '/a/grafana-synthetic-monitoring-app/checks/choose-type',
        action: 'setup',
      },
      learnMore: { href: 'https://grafana.com/docs/grafana-cloud/testing/synthetic-monitoring/' },
    });
    expect(mockAccessibleAppPage).toHaveBeenCalledWith('grafana-synthetic-monitoring-app', '/checks/choose-type');
  });

  it('keeps the offer without a CTA when the setup page is inaccessible', async () => {
    mockProbe.mockResolvedValue(null);
    mockAccessibleAppPage.mockResolvedValue(null);

    await expect(syntheticsSolution().offer()).resolves.toEqual({
      availability: 'setup',
      description: 'Monitor uptime and performance of your endpoints from probes around the world.',
      setupHint: 'create a check',
      cta: null,
      learnMore: { href: 'https://grafana.com/docs/grafana-cloud/testing/synthetic-monitoring/' },
    });
  });

  it('keeps the offer without a CTA when the user cannot create checks', async () => {
    mockProbe.mockResolvedValue(null);
    jest.mocked(contextSrv.hasPermission).mockReturnValue(false);

    await expect(syntheticsSolution().offer()).resolves.toMatchObject({ availability: 'setup', cta: null });
    expect(contextSrv.hasPermission).toHaveBeenCalledWith('grafana-synthetic-monitoring-app.checks:write');
    expect(mockAccessibleAppPage).not.toHaveBeenCalled();
  });

  it('never loads plugin availability for an active solution', async () => {
    await expect(syntheticsSolution().offer()).resolves.toBeNull();
    expect(mockPluginAvailability).not.toHaveBeenCalled();
    expect(mockSetupGuideEnabled).not.toHaveBeenCalled();
  });
});
