import { act, renderHook, waitFor } from '@testing-library/react';

import type { TimeRange } from '@grafana/data';

import * as client from './metricResourceClient';
import { useMetricDetail } from './useMetricDetail';

const range = { raw: { from: 'now-1h', to: 'now' }, from: {}, to: {} } as unknown as TimeRange;

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('useMetricDetail', () => {
  afterEach(() => jest.restoreAllMocks());

  it('does not fetch while disabled', async () => {
    const spy = jest.spyOn(client, 'fetchLabelKeys').mockResolvedValue(['job']);
    renderHook(() => useMetricDetail({ uid: 'p1' }, range, 'up', false));
    expect(spy).not.toHaveBeenCalled();
  });

  it('fetches label keys once enabled', async () => {
    const spy = jest.spyOn(client, 'fetchLabelKeys').mockResolvedValue(['instance', 'job']);
    const { result } = renderHook(() => useMetricDetail({ uid: 'p1' }, range, 'up', true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.labelKeys).toEqual(['instance', 'job']);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('surfaces error without throwing', async () => {
    jest.spyOn(client, 'fetchLabelKeys').mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => useMetricDetail({ uid: 'p1' }, range, 'up', true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe('nope');
    expect(result.current.labelKeys).toEqual([]);
  });

  it('stays disabled across rerenders, then fetches once enabled turns true', async () => {
    const spy = jest.spyOn(client, 'fetchLabelKeys').mockResolvedValue(['job']);
    const { result, rerender } = renderHook(({ enabled }) => useMetricDetail({ uid: 'p1' }, range, 'up', enabled), {
      initialProps: { enabled: false },
    });
    rerender({ enabled: false });
    rerender({ enabled: false });
    expect(spy).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.current.labelKeys).toEqual(['job']);
  });

  it('refetches for the new metric when `metric` changes while enabled', async () => {
    const spy = jest
      .spyOn(client, 'fetchLabelKeys')
      .mockImplementation((_dsRef, _timeRange, metric) => Promise.resolve(metric === 'up' ? ['job'] : ['instance']));
    const { result, rerender } = renderHook(({ metric }) => useMetricDetail({ uid: 'p1' }, range, metric, true), {
      initialProps: { metric: 'up' },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.labelKeys).toEqual(['job']);
    expect(spy).toHaveBeenLastCalledWith({ uid: 'p1' }, range, 'up');

    rerender({ metric: 'node_load1' });
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.labelKeys).toEqual(['instance']));
    expect(spy).toHaveBeenLastCalledWith({ uid: 'p1' }, range, 'node_load1');
  });

  it('does not let a superseded response overwrite a newer one (stale-response ordering)', async () => {
    const first = deferred<string[]>();
    const second = deferred<string[]>();
    const spy = jest
      .spyOn(client, 'fetchLabelKeys')
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const { result, rerender } = renderHook(({ metric }) => useMetricDetail({ uid: 'p1' }, range, metric, true), {
      initialProps: { metric: 'up' },
    });
    rerender({ metric: 'node_load1' });
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));

    // Resolve the newer (node_load1) request first, then the older (up) one arrives late. Both
    // resolutions are wrapped in `act` so the resulting state updates (or lack thereof, if the
    // `cancelled` guard drops the stale one) are flushed before the assertion below runs.
    await act(async () => {
      second.resolve(['instance']);
      await second.promise;
    });
    await act(async () => {
      first.resolve(['job']);
      await first.promise;
    });

    expect(result.current.labelKeys).toEqual(['instance']);
  });

  it('raises `loading` and clears stale `labelKeys` in the render that starts a new fetch, before the promise resolves', async () => {
    const pending = deferred<string[]>();
    const spy = jest
      .spyOn(client, 'fetchLabelKeys')
      .mockResolvedValueOnce(['job'])
      .mockImplementationOnce(() => pending.promise);

    const { result, rerender } = renderHook(({ metric }) => useMetricDetail({ uid: 'p1' }, range, metric, true), {
      initialProps: { metric: 'up' },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.labelKeys).toEqual(['job']);

    // Switch metric. Assert on the state right after this render — before the second (never
    // resolved here) promise settles — that `loading` is already `true` and the previous
    // metric's `labelKeys` are already gone, not lingering until the fetch completes.
    rerender({ metric: 'node_load1' });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(true);
    expect(result.current.labelKeys).toEqual([]);
  });

  it('refetches when the cache is invalidated, so a host refresh control reaches an expanded row', async () => {
    const spy = jest.spyOn(client, 'fetchLabelKeys').mockResolvedValue(['instance', 'job']);
    const { result } = renderHook(() => useMetricDetail({ uid: 'p1' }, range, 'up', true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(spy).toHaveBeenCalledTimes(1);

    act(() => client.invalidateMetricCache());

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
  });
});
