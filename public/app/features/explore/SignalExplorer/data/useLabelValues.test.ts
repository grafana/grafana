import { act, renderHook, waitFor } from '@testing-library/react';

import type { TimeRange } from '@grafana/data';

import * as client from './metricResourceClient';
import { useLabelValues } from './useLabelValues';

const range = { raw: { from: 'now-1h', to: 'now' }, from: {}, to: {} } as unknown as TimeRange;

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('useLabelValues', () => {
  afterEach(() => jest.restoreAllMocks());

  it('does not fetch while disabled', async () => {
    const spy = jest.spyOn(client, 'fetchLabelValues').mockResolvedValue([]);
    renderHook(() => useLabelValues({ uid: 'p1' }, range, 'up', 'job', false));
    expect(spy).not.toHaveBeenCalled();
  });

  it('fetches values once enabled, scoped to metric+label', async () => {
    const spy = jest.spyOn(client, 'fetchLabelValues').mockResolvedValue(['prometheus', 'grafana']);
    const { result } = renderHook(() => useLabelValues({ uid: 'p1' }, range, 'up', 'job', true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.values).toEqual(['prometheus', 'grafana']);
    expect(spy).toHaveBeenCalledWith({ uid: 'p1' }, range, 'up', 'job');
  });

  it('surfaces error without throwing', async () => {
    jest.spyOn(client, 'fetchLabelValues').mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => useLabelValues({ uid: 'p1' }, range, 'up', 'job', true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe('nope');
    expect(result.current.values).toEqual([]);
  });

  it('stays disabled across rerenders, then fetches once enabled turns true', async () => {
    const spy = jest.spyOn(client, 'fetchLabelValues').mockResolvedValue(['job']);
    const { result, rerender } = renderHook(
      ({ enabled }) => useLabelValues({ uid: 'p1' }, range, 'up', 'job', enabled),
      { initialProps: { enabled: false } }
    );
    rerender({ enabled: false });
    rerender({ enabled: false });
    expect(spy).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.current.values).toEqual(['job']);
  });

  it('refetches for the new label key when `labelKey` changes while enabled', async () => {
    const spy = jest
      .spyOn(client, 'fetchLabelValues')
      .mockImplementation((_dsRef, _timeRange, _metric, labelKey) =>
        Promise.resolve(labelKey === 'job' ? ['prometheus'] : ['us-east'])
      );
    const { result, rerender } = renderHook(
      ({ labelKey }) => useLabelValues({ uid: 'p1' }, range, 'up', labelKey, true),
      { initialProps: { labelKey: 'job' } }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.values).toEqual(['prometheus']);
    expect(spy).toHaveBeenLastCalledWith({ uid: 'p1' }, range, 'up', 'job');

    rerender({ labelKey: 'region' });
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.values).toEqual(['us-east']));
    expect(spy).toHaveBeenLastCalledWith({ uid: 'p1' }, range, 'up', 'region');
  });

  it('refetches for the new metric when `metric` changes while enabled', async () => {
    const spy = jest
      .spyOn(client, 'fetchLabelValues')
      .mockImplementation((_dsRef, _timeRange, metric) =>
        Promise.resolve(metric === 'up' ? ['prometheus'] : ['grafana'])
      );
    const { result, rerender } = renderHook(({ metric }) => useLabelValues({ uid: 'p1' }, range, metric, 'job', true), {
      initialProps: { metric: 'up' },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.values).toEqual(['prometheus']);
    expect(spy).toHaveBeenLastCalledWith({ uid: 'p1' }, range, 'up', 'job');

    rerender({ metric: 'node_load1' });
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.values).toEqual(['grafana']));
    expect(spy).toHaveBeenLastCalledWith({ uid: 'p1' }, range, 'node_load1', 'job');
  });

  it('does not let a superseded response overwrite a newer one (stale-response ordering)', async () => {
    const first = deferred<string[]>();
    const second = deferred<string[]>();
    const spy = jest
      .spyOn(client, 'fetchLabelValues')
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const { result, rerender } = renderHook(
      ({ labelKey }) => useLabelValues({ uid: 'p1' }, range, 'up', labelKey, true),
      { initialProps: { labelKey: 'job' } }
    );
    rerender({ labelKey: 'region' });
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));

    // Resolve the newer (region) request first, then the older (job) one arrives late. Both
    // resolutions are wrapped in `act` so the resulting state updates (or lack thereof, if the
    // `cancelled` guard drops the stale one) are flushed before the assertion below runs.
    await act(async () => {
      second.resolve(['us-east']);
      await second.promise;
    });
    await act(async () => {
      first.resolve(['prometheus']);
      await first.promise;
    });

    expect(result.current.values).toEqual(['us-east']);
  });

  it('raises `loading` and clears stale `values` in the render that starts a new fetch, before the promise resolves', async () => {
    const pending = deferred<string[]>();
    const spy = jest
      .spyOn(client, 'fetchLabelValues')
      .mockResolvedValueOnce(['prometheus'])
      .mockImplementationOnce(() => pending.promise);

    const { result, rerender } = renderHook(
      ({ labelKey }) => useLabelValues({ uid: 'p1' }, range, 'up', labelKey, true),
      { initialProps: { labelKey: 'job' } }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.values).toEqual(['prometheus']);

    // Switch label key. Assert on the state right after this render — before the second (never
    // resolved here) promise settles — that `loading` is already `true` and the previous label
    // key's `values` are already gone, not lingering until the fetch completes.
    rerender({ labelKey: 'region' });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(true);
    expect(result.current.values).toEqual([]);
  });

  it('refetches when the cache is invalidated, so a host refresh control reaches an expanded label', async () => {
    const spy = jest.spyOn(client, 'fetchLabelValues').mockResolvedValue(['web-1']);
    const { result } = renderHook(() => useLabelValues({ uid: 'p1' }, range, 'up', 'job', true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(spy).toHaveBeenCalledTimes(1);

    act(() => client.invalidateMetricCache());

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
  });
});
