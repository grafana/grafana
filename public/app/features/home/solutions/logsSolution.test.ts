import { type DataSourceInstanceListItem } from '@grafana/data';

import { LOGS_DRILLDOWN_APP_ID } from './appPluginIds';
import { logsSolution } from './logsSolution';
import { drilldownActiveCta } from './pluginPages';
import { detectSignal } from './solutionState';
import { fetchLogsActivity } from './telemetryData';

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
  fetchLogsActivity: jest.fn(),
}));

const mockDetectSignal = jest.mocked(detectSignal);
const mockDrilldownActiveCta = jest.mocked(drilldownActiveCta);
const mockFetchActivity = jest.mocked(fetchLogsActivity);

function datasource(): DataSourceInstanceListItem {
  return { uid: 'loki-uid', name: 'loki', type: 'loki' } as DataSourceInstanceListItem;
}

beforeEach(() => {
  const ds = datasource();
  mockDetectSignal.mockReset();
  mockDetectSignal.mockResolvedValue({ status: 'active', datasource: ds });
  mockFetchActivity.mockReset();
  mockFetchActivity.mockResolvedValue({ bytes: null, sources: null, series: null });
  mockDrilldownActiveCta.mockReset();
  mockDrilldownActiveCta.mockResolvedValue({ label: 'Open Logs Drilldown', href: '/logs', action: 'open_solution' });
});

describe('logsSolution', () => {
  it('does not start detection or data queries until a fact is requested', () => {
    logsSolution();

    expect(mockDetectSignal).not.toHaveBeenCalled();
    expect(mockFetchActivity).not.toHaveBeenCalled();
    expect(mockDrilldownActiveCta).not.toHaveBeenCalled();
  });

  it('shares detection and activity across fact readers', async () => {
    const solution = logsSolution();

    await Promise.all([solution.signal(), solution.datasource(), solution.stats(), solution.sparkline()]);
    await solution.stats();

    expect(mockDetectSignal).toHaveBeenCalledTimes(1);
    expect(mockFetchActivity).toHaveBeenCalledTimes(1);
  });

  it('does not query activity when no datasource has data', async () => {
    mockDetectSignal.mockResolvedValue({ status: 'inactive', datasource: null });
    const solution = logsSolution();

    await expect(solution.signal()).resolves.toBe('inactive');
    await expect(solution.datasource()).resolves.toBeNull();
    await expect(solution.stats()).resolves.toBeNull();
    await expect(solution.sparkline()).resolves.toBeNull();
    await expect(solution.cta()).resolves.toBeNull();

    expect(mockFetchActivity).not.toHaveBeenCalled();
    expect(mockDrilldownActiveCta).not.toHaveBeenCalled();
  });

  describe('stats', () => {
    it('shows ingested volume with the approximate source count', async () => {
      mockFetchActivity.mockResolvedValue({ bytes: 47_000_000_000, sources: 8, series: null });

      await expect(logsSolution().stats()).resolves.toEqual({
        primary: '47 GB',
        secondary: 'ingested · 7d · ~8 sources',
      });
    });

    it('degrades the secondary when the source count is unavailable', async () => {
      mockFetchActivity.mockResolvedValue({ bytes: 47_000_000_000, sources: null, series: null });

      await expect(logsSolution().stats()).resolves.toEqual({
        primary: '47 GB',
        secondary: 'ingested · 7d',
      });
    });

    it('returns no stats without an ingest volume', async () => {
      await expect(logsSolution().stats()).resolves.toBeNull();
    });
  });

  describe('sparkline', () => {
    it('carries the ingest-volume trend when present', async () => {
      const series = { x: { values: [1] }, y: { values: [2] } } as never;
      mockFetchActivity.mockResolvedValue({ bytes: null, sources: null, series });

      await expect(logsSolution().sparkline()).resolves.toEqual({
        series,
        caption: 'Ingest volume · last 24h',
      });
    });

    it('omits the sparkline when the trend is unavailable', async () => {
      await expect(logsSolution().sparkline()).resolves.toBeNull();
    });
  });

  it('builds the active CTA from the datasource that proved usage', async () => {
    const ds = datasource();
    const solution = logsSolution();

    await expect(solution.cta()).resolves.toEqual({
      label: 'Open Logs Drilldown',
      href: '/logs',
      action: 'open_solution',
    });
    expect(mockDrilldownActiveCta).toHaveBeenCalledWith(
      ds,
      LOGS_DRILLDOWN_APP_ID,
      'Logs Drilldown',
      `/a/${LOGS_DRILLDOWN_APP_ID}/explore?var-ds=loki-uid`
    );
  });

  it('has no alert or refined stats facts', async () => {
    const solution = logsSolution();

    await expect(solution.alert()).resolves.toBeNull();
    await expect(solution.refinedStats()).resolves.toBeNull();
  });
});
