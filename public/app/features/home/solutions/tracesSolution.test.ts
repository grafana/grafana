import { type DataSourceInstanceListItem } from '@grafana/data';

import { HOSTED_TRACES_APP_ID } from './appPluginIds';
import { drilldownActiveCta } from './pluginPages';
import { detectSignal } from './solutionState';
import { fetchTracesActivity, fetchTracesServices } from './telemetryData';
import { tracesSolution } from './tracesSolution';

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
  fetchTracesActivity: jest.fn(),
  fetchTracesServices: jest.fn(),
}));

const mockDetectSignal = jest.mocked(detectSignal);
const mockDrilldownActiveCta = jest.mocked(drilldownActiveCta);
const mockFetchActivity = jest.mocked(fetchTracesActivity);
const mockFetchServices = jest.mocked(fetchTracesServices);

function datasource(): DataSourceInstanceListItem {
  return { uid: 'tempo-uid', name: 'tempo', type: 'tempo' } as DataSourceInstanceListItem;
}

beforeEach(() => {
  const ds = datasource();
  mockDetectSignal.mockReset();
  mockDetectSignal.mockResolvedValue({ status: 'active', datasource: ds });
  mockFetchActivity.mockReset();
  mockFetchActivity.mockResolvedValue({ spans: 4_800_000, series: null, lookbackHours: 24 });
  mockFetchServices.mockReset();
  mockFetchServices.mockResolvedValue(34);
  mockDrilldownActiveCta.mockReset();
  mockDrilldownActiveCta.mockResolvedValue({
    label: 'Open Traces Drilldown',
    href: '/traces',
    action: 'open_solution',
  });
});

describe('tracesSolution', () => {
  it('does not start detection or data queries until a fact is requested', () => {
    tracesSolution();

    expect(mockDetectSignal).not.toHaveBeenCalled();
    expect(mockFetchActivity).not.toHaveBeenCalled();
    expect(mockFetchServices).not.toHaveBeenCalled();
    expect(mockDrilldownActiveCta).not.toHaveBeenCalled();
  });

  it('shares detection and activity across readers while keeping services independently lazy', async () => {
    const solution = tracesSolution();

    await Promise.all([solution.signal(), solution.datasource(), solution.stats(), solution.sparkline()]);
    await solution.stats();

    expect(mockDetectSignal).toHaveBeenCalledTimes(1);
    expect(mockFetchActivity).toHaveBeenCalledTimes(1);
    expect(mockFetchServices).not.toHaveBeenCalled();

    await Promise.all([solution.refinedStats(), solution.refinedStats()]);
    expect(mockFetchActivity).toHaveBeenCalledTimes(1);
    expect(mockFetchServices).toHaveBeenCalledTimes(1);
  });

  it('does not query activity or services when no datasource has data', async () => {
    mockDetectSignal.mockResolvedValue({ status: 'inactive', datasource: null });
    const solution = tracesSolution();

    await expect(solution.signal()).resolves.toBe('inactive');
    await expect(solution.stats()).resolves.toBeNull();
    await expect(solution.refinedStats()).resolves.toBeNull();
    await expect(solution.sparkline()).resolves.toBeNull();
    await expect(solution.cta()).resolves.toBeNull();

    expect(mockFetchActivity).not.toHaveBeenCalled();
    expect(mockFetchServices).not.toHaveBeenCalled();
    expect(mockDrilldownActiveCta).not.toHaveBeenCalled();
  });

  describe('stats', () => {
    it('resolves from span activity without starting the services probe', async () => {
      mockFetchServices.mockImplementation(() => new Promise(() => {}));
      const solution = tracesSolution();

      await expect(solution.stats()).resolves.toEqual({
        primary: '4.80 Mil spans',
        secondary: 'traced · 24h',
      });
      expect(mockFetchServices).not.toHaveBeenCalled();
    });

    it('returns no stats without a span count', async () => {
      mockFetchActivity.mockResolvedValue({ spans: null, series: null, lookbackHours: 24 });

      await expect(tracesSolution().stats()).resolves.toBeNull();
    });
  });

  describe('refinedStats', () => {
    it('folds the service count into the secondary once it lands', async () => {
      await expect(tracesSolution().refinedStats()).resolves.toEqual({
        primary: '4.80 Mil spans',
        secondary: 'traced · 24h · 34 services',
      });
    });

    it('keeps the base stats when the services probe fails', async () => {
      mockFetchServices.mockRejectedValue(new Error('tempo down'));

      await expect(tracesSolution().refinedStats()).resolves.toBeNull();
    });

    it('keeps the base stats when the services probe resolves empty', async () => {
      mockFetchServices.mockResolvedValue(null);

      await expect(tracesSolution().refinedStats()).resolves.toBeNull();
    });
  });

  describe('sparkline', () => {
    it('carries the span-throughput trend when present', async () => {
      const series = { x: { values: [1] }, y: { values: [2] } } as never;
      mockFetchActivity.mockResolvedValue({ spans: null, series, lookbackHours: 24 });

      await expect(tracesSolution().sparkline()).resolves.toEqual({
        series,
        caption: 'Span throughput · last 24h',
      });
    });

    it('omits the sparkline when the trend is unavailable', async () => {
      mockFetchActivity.mockResolvedValue({ spans: null, series: null, lookbackHours: 24 });

      await expect(tracesSolution().sparkline()).resolves.toBeNull();
    });

    it('labels a Tempo 2.x fallback with its shorter lookback', async () => {
      const series = { x: { values: [1] }, y: { values: [2] } } as never;
      mockFetchActivity.mockResolvedValue({ spans: 120, series, lookbackHours: 3 });
      const solution = tracesSolution();

      await expect(solution.stats()).resolves.toEqual({ primary: '120 spans', secondary: 'traced · 3h' });
      await expect(solution.sparkline()).resolves.toEqual({ series, caption: 'Span throughput · last 3h' });
    });
  });

  it('builds the active CTA from the datasource that proved usage', async () => {
    const ds = datasource();
    const solution = tracesSolution();

    await expect(solution.cta()).resolves.toEqual({
      label: 'Open Traces Drilldown',
      href: '/traces',
      action: 'open_solution',
    });
    expect(mockDrilldownActiveCta).toHaveBeenCalledWith(
      ds,
      HOSTED_TRACES_APP_ID,
      'Traces Drilldown',
      `/a/${HOSTED_TRACES_APP_ID}/explore?var-ds=tempo-uid`
    );
  });

  it('has no alert fact', async () => {
    await expect(tracesSolution().alert()).resolves.toBeNull();
  });
});
