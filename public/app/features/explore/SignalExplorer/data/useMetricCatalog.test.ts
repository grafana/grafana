import { act, renderHook, waitFor } from '@testing-library/react';

import type { TimeRange } from '@grafana/data';

import type { MetricInfo } from '../types';

import * as client from './metricResourceClient';
import { useMetricCatalog } from './useMetricCatalog';

const range = { raw: { from: 'now-1h', to: 'now' }, from: {}, to: {} } as unknown as TimeRange;
const rows: MetricInfo[] = [
  { name: 'http_requests_total', type: 'counter', help: 'h' },
  { name: 'node_load1', type: 'gauge', help: 'l' },
];

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('useMetricCatalog', () => {
  afterEach(() => jest.restoreAllMocks());

  it('loads then exposes metrics', async () => {
    jest.spyOn(client, 'fetchCatalog').mockResolvedValue(rows);
    const { result } = renderHook(() => useMetricCatalog({ uid: 'p1' }, range));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.metrics).toHaveLength(2);
  });

  it('applies substring filter and type filter', async () => {
    jest.spyOn(client, 'fetchCatalog').mockResolvedValue(rows);
    const { result } = renderHook(() =>
      useMetricCatalog({ uid: 'p1' }, range, { searchText: 'load', typeFilter: 'gauge' })
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.metrics.map((m) => m.name)).toEqual(['node_load1']);
  });

  it('surfaces error without throwing when the client rejects', async () => {
    jest.spyOn(client, 'fetchCatalog').mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useMetricCatalog({ uid: 'p1' }, range));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe('boom');
    expect(result.current.metrics).toEqual([]);
  });

  it('filters case-insensitively on search text', async () => {
    jest.spyOn(client, 'fetchCatalog').mockResolvedValue(rows);
    const { result } = renderHook(() => useMetricCatalog({ uid: 'p1' }, range, { searchText: 'LOAD' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.metrics.map((m) => m.name)).toEqual(['node_load1']);
  });

  it('trims the search text, which otherwise matches no metric name at all', async () => {
    jest.spyOn(client, 'fetchCatalog').mockResolvedValue(rows);
    const { result } = renderHook(() => useMetricCatalog({ uid: 'p1' }, range, { searchText: '  load ' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.metrics.map((m) => m.name)).toEqual(['node_load1']);
  });

  it('refetches when the datasource uid changes', async () => {
    const spy = jest.spyOn(client, 'fetchCatalog').mockResolvedValue(rows);
    const { result, rerender } = renderHook(({ dsRef }) => useMetricCatalog(dsRef, range), {
      initialProps: { dsRef: { uid: 'p1' } },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenLastCalledWith({ uid: 'p1' }, range);

    rerender({ dsRef: { uid: 'p2' } });
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    expect(spy).toHaveBeenLastCalledWith({ uid: 'p2' }, range);
  });

  it('refetches when a type-only ref changes type, even though `uid` is undefined both times', async () => {
    const spy = jest.spyOn(client, 'fetchCatalog').mockResolvedValue(rows);
    const { result, rerender } = renderHook(({ dsRef }) => useMetricCatalog(dsRef, range), {
      initialProps: { dsRef: { type: 'prometheus' } },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenLastCalledWith({ type: 'prometheus' }, range);

    rerender({ dsRef: { type: 'loki' } });
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    expect(spy).toHaveBeenLastCalledWith({ type: 'loki' }, range);
  });

  it('refetches when a uid-only ref is swapped for a type-only ref of the same string', async () => {
    // The client keys these two apart (`u:prometheus` vs `t:prometheus`), so the hook must too —
    // otherwise it keeps painting the first one's catalog while the client holds a different entry.
    const spy = jest.spyOn(client, 'fetchCatalog').mockResolvedValue(rows);
    const { result, rerender } = renderHook(({ dsRef }) => useMetricCatalog(dsRef, range), {
      initialProps: { dsRef: { uid: 'prometheus' } as { uid?: string; type?: string } },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(spy).toHaveBeenCalledTimes(1);

    rerender({ dsRef: { type: 'prometheus' } });

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    expect(spy).toHaveBeenLastCalledWith({ type: 'prometheus' }, range);
  });

  it('refetches when the cache is invalidated, so a host refresh control reaches a mounted tree', async () => {
    // Expiry alone never gets here: a relative range is one request key for the life of the page.
    const spy = jest.spyOn(client, 'fetchCatalog').mockResolvedValue(rows);
    const { result } = renderHook(() => useMetricCatalog({ uid: 'p1' }, range));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(spy).toHaveBeenCalledTimes(1);

    act(() => client.invalidateMetricCache());

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
  });

  it('ignores an invalidation aimed at a different datasource', async () => {
    const spy = jest.spyOn(client, 'fetchCatalog').mockResolvedValue(rows);
    const { result } = renderHook(() => useMetricCatalog({ uid: 'p1' }, range));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => client.invalidateMetricCache({ uid: 'p2' }));

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not let a superseded response overwrite a newer one (stale-response ordering)', async () => {
    const first = deferred<MetricInfo[]>();
    const second = deferred<MetricInfo[]>();
    const spy = jest
      .spyOn(client, 'fetchCatalog')
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const { result, rerender } = renderHook(({ dsRef }) => useMetricCatalog(dsRef, range), {
      initialProps: { dsRef: { uid: 'p1' } },
    });
    rerender({ dsRef: { uid: 'p2' } });
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));

    // Resolve the newer (p2) request first, then the older (p1) one arrives late. Both
    // resolutions are wrapped in `act` so the resulting state updates (or lack thereof, if the
    // `cancelled` guard drops the stale one) are flushed before the assertion below runs.
    await act(async () => {
      second.resolve([{ name: 'p2_metric', type: 'counter', help: 'from p2' }]);
      await second.promise;
    });
    await act(async () => {
      first.resolve([{ name: 'p1_metric', type: 'gauge', help: 'from p1' }]);
      await first.promise;
    });

    expect(result.current.metrics.map((m) => m.name)).toEqual(['p2_metric']);
  });

  it('does not throw when unmounting mid-flight', async () => {
    const { promise, resolve } = deferred<MetricInfo[]>();
    jest.spyOn(client, 'fetchCatalog').mockImplementation(() => promise);
    const { unmount } = renderHook(() => useMetricCatalog({ uid: 'p1' }, range));
    unmount();
    await act(async () => {
      resolve(rows);
      await promise;
    });
    // No assertion beyond "the above didn't throw" — this is a smoke check only, not proof the
    // `cancelled` guard works (see the stale-response ordering test above for that).
  });

  it('raises `loading` and clears stale `metrics` in the render that starts a fetch for a new datasource, before the promise resolves', async () => {
    const pending = deferred<MetricInfo[]>();
    const spy = jest
      .spyOn(client, 'fetchCatalog')
      .mockResolvedValueOnce(rows)
      .mockImplementationOnce(() => pending.promise);

    const { result, rerender } = renderHook(({ dsRef }) => useMetricCatalog(dsRef, range), {
      initialProps: { dsRef: { uid: 'p1' } },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.metrics).toHaveLength(2);

    // Switch datasource. Assert on the state right after this render — before the second (never
    // resolved here) promise settles — that `loading` is already `true` and the previous
    // datasource's `metrics` are already gone, not lingering on screen until the fetch completes.
    rerender({ dsRef: { uid: 'p2' } });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(true);
    expect(result.current.metrics).toEqual([]);
  });
});
