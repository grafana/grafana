import { renderHook } from '@testing-library/react';

import { DataFrame, dateTime, TimeRange } from '@grafana/data';

import PromQlLanguageProvider from '../language_provider';

import { usePromQueryFieldEffects } from './usePromQueryFieldEffects';

type TestProps = {
  languageProvider: PromQlLanguageProvider;
  range: TimeRange | undefined;
  series: DataFrame[];
};

describe('usePromQueryFieldEffects', () => {
  const mockLanguageProvider = {
    start: jest.fn().mockResolvedValue([]),
    histogramMetrics: [],
    timeRange: {},
    metrics: ['metric1'],
    startTask: Promise.resolve(),
    datasource: {},
    lookupsDisabled: false,
    syntax: jest.fn(),
    getLabelKeys: jest.fn(),
    cleanText: jest.fn(),
    hasLookupsDisabled: jest.fn(),
    getBeginningCompletionItems: jest.fn(),
    getLabelCompletionItems: jest.fn(),
    getMetricCompletionItems: jest.fn(),
    getTermCompletionItems: jest.fn(),
    request: jest.fn(),
    importQueries: jest.fn(),
    labelKeys: [],
    labelFetchTs: 0,
    getDefaultCacheHeaders: jest.fn(),
    loadMetricsMetadata: jest.fn(),
    loadMetrics: jest.fn(),
    loadLabelKeys: jest.fn(),
    loadLabelValues: jest.fn(),
    modifyQuery: jest.fn(),
  } as unknown as PromQlLanguageProvider;

  const mockRange: TimeRange = {
    from: dateTime('2022-01-01T00:00:00Z'),
    to: dateTime('2022-01-02T00:00:00Z'),
    raw: {
      from: 'now-1d',
      to: 'now',
    },
  };

  const mockNewRange: TimeRange = {
    from: dateTime('2022-01-02T00:00:00Z'),
    to: dateTime('2022-01-03T00:00:00Z'),
    raw: {
      from: 'now-1d',
      to: 'now',
    },
  };

  let refreshMetricsMock: jest.Mock;
  let refreshHintMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    refreshMetricsMock = jest.fn().mockImplementation(() => Promise.resolve());
    refreshHintMock = jest.fn();
  });

  it('should call refreshMetrics and refreshHint on initial render', async () => {
    renderHook(() =>
      usePromQueryFieldEffects(mockLanguageProvider, mockRange, [], refreshMetricsMock, refreshHintMock)
    );

    expect(refreshMetricsMock).toHaveBeenCalledTimes(1);
    expect(refreshHintMock).toHaveBeenCalledTimes(2);
  });

  it('should call refreshMetrics when the time range changes', async () => {
    const { rerender } = renderHook(
      (props: TestProps) =>
        usePromQueryFieldEffects(
          props.languageProvider,
          props.range,
          props.series,
          refreshMetricsMock,
          refreshHintMock
        ),
      {
        initialProps: {
          languageProvider: mockLanguageProvider,
          range: mockRange,
          series: [] as DataFrame[],
        },
      }
    );

    // Initial render already called refreshMetrics once
    expect(refreshMetricsMock).toHaveBeenCalledTimes(1);

    // Change the range
    rerender({
      languageProvider: mockLanguageProvider,
      range: mockNewRange,
      series: [] as DataFrame[],
    });

    expect(refreshMetricsMock).toHaveBeenCalledTimes(2);
  });

  it('should not call refreshMetrics when the time range is the same', () => {
    const { rerender } = renderHook(
      (props: TestProps) =>
        usePromQueryFieldEffects(
          props.languageProvider,
          props.range,
          props.series,
          refreshMetricsMock,
          refreshHintMock
        ),
      {
        initialProps: {
          languageProvider: mockLanguageProvider,
          range: mockRange,
          series: [] as DataFrame[],
        },
      }
    );

    // Initial render already called refreshMetrics once
    expect(refreshMetricsMock).toHaveBeenCalledTimes(1);

    // Rerender with the same range
    rerender({
      languageProvider: mockLanguageProvider,
      range: { ...mockRange }, // create a new object with the same values
      series: [] as DataFrame[],
    });

    // Should still be called only once (from initial render)
    expect(refreshMetricsMock).toHaveBeenCalledTimes(1);
  });

  it('should call refreshHint when series changes', () => {
    const mockSeries = [{ name: 'new series', fields: [], length: 0 }] as DataFrame[];
    const { rerender } = renderHook(
      (props: TestProps) =>
        usePromQueryFieldEffects(
          props.languageProvider,
          props.range,
          props.series,
          refreshMetricsMock,
          refreshHintMock
        ),
      {
        initialProps: {
          languageProvider: mockLanguageProvider,
          range: mockRange,
          series: [] as DataFrame[],
        },
      }
    );

    // Initial render already called refreshHint once
    expect(refreshHintMock).toHaveBeenCalledTimes(2);

    refreshHintMock.mockClear();

    // Change the series
    rerender({
      languageProvider: mockLanguageProvider,
      range: mockRange,
      series: mockSeries,
    });

    expect(refreshHintMock).toHaveBeenCalledTimes(1);
  });

  it('should not call refreshHint when series is the same', () => {
    const series = [] as DataFrame[];
    const { rerender } = renderHook(
      (props: TestProps) =>
        usePromQueryFieldEffects(
          props.languageProvider,
          props.range,
          props.series,
          refreshMetricsMock,
          refreshHintMock
        ),
      {
        initialProps: {
          languageProvider: mockLanguageProvider,
          range: mockRange,
          series,
        },
      }
    );

    // Initial render already called refreshHint once
    refreshHintMock.mockClear();

    // Rerender with the same series
    rerender({
      languageProvider: mockLanguageProvider,
      range: mockRange,
      series, // same empty array
    });

    expect(refreshHintMock).not.toHaveBeenCalled();
  });
});
