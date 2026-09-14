import { type DataSourceInstanceListItem } from '@grafana/data';

import { METRICS_DRILLDOWN_APP_ID } from './appPluginIds';
import { metricsSolution } from './metricsSolution';
import { drilldownActiveCta } from './pluginPages';
import { detectSignal } from './solutionState';
import {
  fetchMetricsActivity,
  fetchMetricsDiskHoursToFull,
  fetchMetricsDiskPressure,
  type MetricsActivity,
} from './telemetryData';

jest.mock('./pluginPages', () => ({
  ...jest.requireActual('./pluginPages'),
  drilldownActiveCta: jest.fn(),
}));

jest.mock('./solutionState', () => ({
  ...jest.requireActual('./solutionState'),
  detectSignal: jest.fn(),
}));

jest.mock('./telemetryData', () => ({
  ...jest.requireActual('./telemetryData'),
  fetchMetricsActivity: jest.fn(),
  fetchMetricsDiskHoursToFull: jest.fn(),
  fetchMetricsDiskPressure: jest.fn(),
}));

const mockDetectSignal = jest.mocked(detectSignal);
const mockDrilldownActiveCta = jest.mocked(drilldownActiveCta);
const mockFetchActivity = jest.mocked(fetchMetricsActivity);
const mockFetchDiskHoursToFull = jest.mocked(fetchMetricsDiskHoursToFull);
const mockFetchDiskPressure = jest.mocked(fetchMetricsDiskPressure);

const emptyActivity: MetricsActivity = {
  series: null,
  dataPointsPerMinute: null,
  names: null,
  hosts: null,
  seriesSparkline: null,
};

function datasource(uid = 'prom-uid'): DataSourceInstanceListItem {
  return { uid, name: uid, type: 'prometheus' } as DataSourceInstanceListItem;
}

beforeEach(() => {
  const ds = datasource();
  mockDetectSignal.mockReset();
  mockDetectSignal.mockResolvedValue({ status: 'active', datasource: ds });
  mockFetchActivity.mockReset();
  mockFetchActivity.mockResolvedValue(emptyActivity);
  mockFetchDiskPressure.mockReset();
  mockFetchDiskPressure.mockResolvedValue(null);
  mockFetchDiskHoursToFull.mockReset();
  mockFetchDiskHoursToFull.mockResolvedValue(null);
  mockDrilldownActiveCta.mockReset();
  mockDrilldownActiveCta.mockResolvedValue({
    label: 'Open Metrics Drilldown',
    href: '/metrics',
    action: 'open_solution',
  });
});

describe('metricsSolution', () => {
  it('does not start detection or data queries until a fact is requested', () => {
    metricsSolution();

    expect(mockDetectSignal).not.toHaveBeenCalled();
    expect(mockFetchActivity).not.toHaveBeenCalled();
    expect(mockFetchDiskPressure).not.toHaveBeenCalled();
    expect(mockFetchDiskHoursToFull).not.toHaveBeenCalled();
    expect(mockDrilldownActiveCta).not.toHaveBeenCalled();
  });

  it('shares detection and activity across fact readers', async () => {
    const solution = metricsSolution();

    await Promise.all([solution.signal(), solution.datasource(), solution.stats(), solution.sparkline()]);
    await solution.stats();

    // Metrics and Kubernetes are separate probes, and each should run once for this solution.
    expect(mockDetectSignal).toHaveBeenCalledTimes(2);
    expect(mockFetchActivity).toHaveBeenCalledTimes(1);
  });

  it('does not wait for Kubernetes when the metrics probe proves data is flowing', async () => {
    const metricsDatasource = datasource('metrics-prom');
    mockDetectSignal
      .mockResolvedValueOnce({ status: 'active', datasource: metricsDatasource })
      .mockReturnValueOnce(new Promise(() => {}));
    const solution = metricsSolution();

    const detected = Promise.all([solution.signal(), solution.datasource()]);
    const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 0));

    expect(mockDetectSignal).toHaveBeenCalledTimes(2);
    await expect(Promise.race([detected, timeout])).resolves.toEqual(['active', metricsDatasource]);
  });

  it('keeps detection inconclusive when metrics is inactive and Kubernetes is unknown', async () => {
    mockDetectSignal
      .mockResolvedValueOnce({ status: 'inactive', datasource: null })
      .mockResolvedValueOnce({ status: 'unknown', datasource: null });
    const solution = metricsSolution();

    await expect(solution.signal()).resolves.toBe('unknown');
    await expect(solution.datasource()).resolves.toBeNull();
  });

  it('uses the Kubernetes datasource when Kubernetes proves metrics are flowing', async () => {
    const kubernetesDatasource = datasource('kubernetes-prom');
    mockDetectSignal
      .mockResolvedValueOnce({ status: 'inactive', datasource: null })
      .mockResolvedValueOnce({ status: 'active', datasource: kubernetesDatasource });
    mockFetchActivity.mockResolvedValue({ ...emptyActivity, series: 12 });
    const solution = metricsSolution();

    await expect(solution.signal()).resolves.toBe('active');
    await expect(solution.datasource()).resolves.toBe(kubernetesDatasource);
    await solution.stats();

    expect(mockFetchActivity).toHaveBeenCalledWith(kubernetesDatasource);
  });

  it('does not query activity or disk pressure when no datasource has data', async () => {
    mockDetectSignal.mockResolvedValue({ status: 'inactive', datasource: null });
    const solution = metricsSolution();

    await expect(solution.signal()).resolves.toBe('inactive');
    await expect(solution.stats()).resolves.toBeNull();
    await expect(solution.sparkline()).resolves.toBeNull();
    await expect(solution.needsAttention()).resolves.toBe(false);
    await expect(solution.alert()).resolves.toBeNull();

    expect(mockFetchActivity).not.toHaveBeenCalled();
    expect(mockFetchDiskPressure).not.toHaveBeenCalled();
  });

  describe('stats', () => {
    it('leads with the series count and ingest rate', async () => {
      mockFetchActivity.mockResolvedValue({ ...emptyActivity, series: 4_200_000, dataPointsPerMinute: 5_160_000 });

      await expect(metricsSolution().stats()).resolves.toEqual({
        primary: '4.20 Mil series',
        secondary: '5.16 Mil data points/min',
      });
    });

    it('falls back to the metric-name count and host count', async () => {
      mockFetchActivity.mockResolvedValue({ ...emptyActivity, names: 1_200, hosts: 12 });

      await expect(metricsSolution().stats()).resolves.toEqual({
        primary: '1.20 K metrics',
        secondary: 'active · 12 hosts',
      });
    });

    it('uses the bare activity qualifier when no secondary count resolved', async () => {
      mockFetchActivity.mockResolvedValue({ ...emptyActivity, names: 7 });

      await expect(metricsSolution().stats()).resolves.toEqual({ primary: '7 metrics', secondary: 'active' });
    });

    it('returns no stats when neither series nor names resolved', async () => {
      await expect(metricsSolution().stats()).resolves.toBeNull();
    });
  });

  describe('sparkline', () => {
    it('carries the active-series trend when present', async () => {
      const series = { x: { values: [1] }, y: { values: [2] } } as never;
      mockFetchActivity.mockResolvedValue({ ...emptyActivity, seriesSparkline: series });

      await expect(metricsSolution().sparkline()).resolves.toEqual({
        series,
        caption: 'Active series · last 24h',
      });
    });

    it('omits the sparkline when the trend is unavailable', async () => {
      await expect(metricsSolution().sparkline()).resolves.toBeNull();
    });
  });

  describe('alert', () => {
    it('builds the disk alert with the port-stripped worst host and a clamped ETA', async () => {
      mockFetchDiskPressure.mockResolvedValue({
        hostsAbove: 3,
        worstInstance: 'web-03:9100',
        worstMount: '/data',
        worstRatio: 0.96,
      });
      mockFetchDiskHoursToFull.mockResolvedValue(0.3);

      const solution = metricsSolution();
      await expect(solution.needsAttention()).resolves.toBe(true);
      expect(mockFetchDiskHoursToFull).not.toHaveBeenCalled();
      await expect(solution.alert()).resolves.toMatchObject({
        primary: '3 hosts above 90% disk',
        details: ['web-03 at 96%', '~1 h to full'],
      });
      expect(mockFetchDiskPressure).toHaveBeenCalledTimes(1);
      expect(mockFetchDiskHoursToFull).toHaveBeenCalledWith(
        'web-03:9100',
        '/data',
        expect.objectContaining({ uid: 'prom-uid' })
      );
    });

    it('returns no alert below the disk threshold', async () => {
      const solution = metricsSolution();

      await expect(solution.needsAttention()).resolves.toBe(false);
      await expect(solution.alert()).resolves.toBeNull();
      expect(mockFetchDiskHoursToFull).not.toHaveBeenCalled();
    });

    it('omits detail rows whose source values are missing', async () => {
      mockFetchDiskPressure.mockResolvedValue({
        hostsAbove: 1,
        worstInstance: null,
        worstMount: null,
        worstRatio: null,
      });

      await expect(metricsSolution().alert()).resolves.toMatchObject({ details: [] });
    });
  });

  it('builds the attention CTA from classification without waiting for alert details', async () => {
    mockFetchDiskPressure.mockResolvedValue({
      hostsAbove: 1,
      worstInstance: 'web-03:9100',
      worstMount: '/data',
      worstRatio: 0.96,
    });
    mockFetchDiskHoursToFull.mockRejectedValue(new Error('query failed'));

    await expect(metricsSolution().cta()).resolves.toEqual({
      label: 'Investigate disk usage in Explore',
      href: expect.stringMatching(/^\/explore\?left=/),
      action: 'view_alerts',
    });
    expect(mockFetchDiskHoursToFull).not.toHaveBeenCalled();
    expect(mockDrilldownActiveCta).not.toHaveBeenCalled();
  });

  it('builds the active CTA from the datasource that proved usage', async () => {
    const ds = datasource();
    const solution = metricsSolution();

    await expect(solution.cta()).resolves.toEqual({
      label: 'Open Metrics Drilldown',
      href: '/metrics',
      action: 'open_solution',
    });
    expect(mockDrilldownActiveCta).toHaveBeenCalledWith(
      ds,
      METRICS_DRILLDOWN_APP_ID,
      'Metrics Drilldown',
      `/a/${METRICS_DRILLDOWN_APP_ID}/drilldown`
    );
  });
});
