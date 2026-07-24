import { renderHook, waitFor } from '@testing-library/react';

import type { TimeRange } from '@grafana/data';

import type { MetricRow } from '../types';

import * as client from './metricResourceClient';
import { useMetricCatalog } from './useMetricCatalog';

const range = { raw: { from: 'now-1h', to: 'now' }, from: {}, to: {} } as unknown as TimeRange;
const rows: MetricRow[] = [
  { name: 'http_requests_total', type: 'counter', help: 'h' },
  { name: 'node_load1', type: 'gauge', help: 'l' },
];

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

  it('does not update state after unmount', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    let resolveFetch: (rows: MetricRow[]) => void = () => {};
    jest.spyOn(client, 'fetchCatalog').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );
    const { unmount } = renderHook(() => useMetricCatalog({ uid: 'p1' }, range));
    unmount();
    resolveFetch(rows);
    // Flush microtasks; if the hook ignores the `cancelled` guard this would trigger a
    // React "state update on unmounted component" warning captured by the console.error spy.
    await Promise.resolve();
    await Promise.resolve();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
