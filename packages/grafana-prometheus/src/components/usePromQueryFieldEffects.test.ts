import { renderHook } from '@testing-library/react';
import React from 'react';

import { dateTime } from '@grafana/data';

import { CancelablePromise } from './cancelable-promise';
import { usePromQueryFieldEffects } from './usePromQueryFieldEffects';

jest.mock('../language_utils', () => ({
  roundMsToMin: jest.fn((value) => value),
}));

describe('usePromQueryFieldEffects', () => {
  const mockCancelFn = jest.fn();
  const mockLanguageProvider = {
    metrics: ['metric1', 'metric2'],
  };

  const createMockPromise = (): CancelablePromise<any> => ({
    promise: Promise.resolve([]),
    cancel: mockCancelFn,
  });

  const mockRange = {
    from: dateTime('2022-01-01T00:00:00Z'),
    to: dateTime('2022-01-02T00:00:00Z'),
    raw: {
      from: 'now-1d',
      to: 'now',
    },
  };

  const mockNewRange = {
    from: dateTime('2022-01-02T00:00:00Z'),
    to: dateTime('2022-01-03T00:00:00Z'),
    raw: {
      from: 'now-1d',
      to: 'now',
    },
  };

  const mockData = {
    series: [{ name: 'test' }],
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
      usePromQueryFieldEffects(mockLanguageProvider, mockRange, mockData, refreshMetricsMock, refreshHintMock)
    );

    expect(refreshMetricsMock).toHaveBeenCalledTimes(1);
    expect(refreshHintMock).toHaveBeenCalledTimes(1);
  });

  it('should not call refreshMetrics if languageProvider is not provided', () => {
    renderHook(() => usePromQueryFieldEffects(null as any, mockRange, mockData, refreshMetricsMock, refreshHintMock));

    expect(refreshMetricsMock).not.toHaveBeenCalled();
    expect(refreshHintMock).toHaveBeenCalledTimes(1);
  });

  it('should call refreshMetrics when the time range changes', async () => {
    const { rerender } = renderHook(
      (props: any) =>
        usePromQueryFieldEffects(props.languageProvider, props.range, props.data, refreshMetricsMock, refreshHintMock),
      {
        initialProps: {
          languageProvider: mockLanguageProvider,
          range: mockRange,
          data: mockData,
        },
      }
    );

    // Initial render already called refreshMetrics once
    expect(refreshMetricsMock).toHaveBeenCalledTimes(1);

    // Change the range
    rerender({
      languageProvider: mockLanguageProvider,
      range: mockNewRange,
      data: mockData,
    });

    expect(refreshMetricsMock).toHaveBeenCalledTimes(2);
  });

  it('should not call refreshMetrics when the time range is the same', () => {
    const { rerender } = renderHook(
      (props: any) =>
        usePromQueryFieldEffects(props.languageProvider, props.range, props.data, refreshMetricsMock, refreshHintMock),
      {
        initialProps: {
          languageProvider: mockLanguageProvider,
          range: mockRange,
          data: mockData,
        },
      }
    );

    // Initial render already called refreshMetrics once
    expect(refreshMetricsMock).toHaveBeenCalledTimes(1);

    // Rerender with the same range
    rerender({
      languageProvider: mockLanguageProvider,
      range: { ...mockRange }, // create a new object with the same values
      data: mockData,
    });

    // Should still be called only once (from initial render)
    expect(refreshMetricsMock).toHaveBeenCalledTimes(1);
  });

  it('should not call refreshMetrics if range is not provided', () => {
    const { rerender } = renderHook(
      (props: any) =>
        usePromQueryFieldEffects(props.languageProvider, props.range, props.data, refreshMetricsMock, refreshHintMock),
      {
        initialProps: {
          languageProvider: mockLanguageProvider,
          range: mockRange,
          data: mockData,
        },
      }
    );

    // Initial render already called refreshMetrics
    refreshMetricsMock.mockClear();

    // Change the range to undefined
    rerender({
      languageProvider: mockLanguageProvider,
      range:  {
        from: dateTime('2022-01-01T00:00:00Z'),
        to: dateTime('2022-01-02T00:00:00Z'),
        raw: {
          from: 'now-1d',
          to: 'now',
        },
      },
      data: mockData,
    });

    expect(refreshMetricsMock).not.toHaveBeenCalled();
  });

  it('should call refreshHint when data.series changes', () => {
    const { rerender } = renderHook(
      (props: any) =>
        usePromQueryFieldEffects(props.languageProvider, props.range, props.data, refreshMetricsMock, refreshHintMock),
      {
        initialProps: {
          languageProvider: mockLanguageProvider,
          range: mockRange,
          data: mockData,
        },
      }
    );

    // Initial render already called refreshHint once
    expect(refreshHintMock).toHaveBeenCalledTimes(1);

    refreshHintMock.mockClear();

    // Change the data
    rerender({
      languageProvider: mockLanguageProvider,
      range: mockRange,
      data: {
        series: [{ name: 'new test data' }],
      },
    });

    expect(refreshHintMock).toHaveBeenCalledTimes(1);
  });

  it('should not call refreshHint when data.series is the same', () => {
    const { rerender } = renderHook(
      (props: any) =>
        usePromQueryFieldEffects(props.languageProvider, props.range, props.data, refreshMetricsMock, refreshHintMock),
      {
        initialProps: {
          languageProvider: mockLanguageProvider,
          range: mockRange,
          data: mockData,
        },
      }
    );

    // Initial render already called refreshHint once
    refreshHintMock.mockClear();

    // Rerender with the same data
    rerender({
      languageProvider: mockLanguageProvider,
      range: mockRange,
      data: { ...mockData }, // create a new object with the same values
    });

    expect(refreshHintMock).not.toHaveBeenCalled();
  });

  it('should cancel any ongoing promise during cleanup', () => {
    // Mock the ref to simulate an ongoing promise
    const promiseRef = { current: createMockPromise() };
    const originalUseRef = React.useRef;
    jest.spyOn(React, 'useRef').mockImplementation((initialValue) => {
      if (initialValue === null) {
        return promiseRef as any;
      }
      return originalUseRef(initialValue);
    });

    const { unmount } = renderHook(() =>
      usePromQueryFieldEffects(mockLanguageProvider, mockRange, mockData, refreshMetricsMock, refreshHintMock)
    );

    // Unmount to trigger cleanup
    unmount();

    expect(mockCancelFn).toHaveBeenCalledTimes(1);
  });
});
