import { act, renderHook, waitFor } from '@testing-library/react';

import { type DataSourceApi } from '@grafana/data';
import { setDataSourceSrv } from '@grafana/runtime';
import { type DataSourceRef } from '@grafana/schema';

import { getMockedDatasourceSrv } from '../utils/mocks';

import { useDataSourceInstance } from './useDataSourceInstance';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: undefined,
  useDataSourceInstance: undefined,
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceInstance: undefined,
  useDataSourceInstance: undefined,
}));

const mockDatasourceSrv = getMockedDatasourceSrv();

const alpha = { uid: 'ds-a', type: 'loki', name: 'A' } as DataSourceApi;
const bravo = { uid: 'ds-b', type: 'tempo', name: 'B' } as DataSourceApi;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('useDataSourceInstance', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setDataSourceSrv(mockDatasourceSrv);
  });

  it('should be loading until the data source resolves', async () => {
    mockDatasourceSrv.get.mockResolvedValue(alpha);

    const { result } = renderHook(() => useDataSourceInstance('ds-a'));

    expect(result.current).toEqual({ isLoading: true });
    await waitFor(() => expect(result.current).toEqual({ isLoading: false, dataSource: alpha }));
  });

  it('should resolve by uid', async () => {
    mockDatasourceSrv.get.mockResolvedValue(alpha);

    const { result } = renderHook(() => useDataSourceInstance('ds-a'));

    await waitFor(() => expect(result.current.dataSource).toBe(alpha));
    expect(mockDatasourceSrv.get).toHaveBeenCalledWith('ds-a', undefined);
  });

  it('should resolve by ref object', async () => {
    mockDatasourceSrv.get.mockResolvedValue(alpha);
    const ref: DataSourceRef = { uid: 'ds-a', type: 'loki' };

    const { result } = renderHook(() => useDataSourceInstance(ref));

    await waitFor(() => expect(result.current.dataSource).toBe(alpha));
    expect(mockDatasourceSrv.get).toHaveBeenCalledWith(ref, undefined);
  });

  it('should resolve the default data source when ref is undefined', async () => {
    mockDatasourceSrv.get.mockResolvedValue(alpha);

    const { result } = renderHook(() => useDataSourceInstance());

    await waitFor(() => expect(result.current.dataSource).toBe(alpha));
    expect(mockDatasourceSrv.get).toHaveBeenCalledWith(undefined, undefined);
  });

  it('should not refetch when the ref changes from undefined to null', async () => {
    mockDatasourceSrv.get.mockResolvedValue(alpha);
    const { result, rerender } = renderHook(({ ref }) => useDataSourceInstance(ref), {
      initialProps: { ref: undefined as string | null | undefined },
    });
    await waitFor(() => expect(result.current.dataSource).toBe(alpha));

    rerender({ ref: null });

    expect(mockDatasourceSrv.get).toHaveBeenCalledTimes(1);
  });

  it('should return the error when the data source fails to resolve', async () => {
    const error = new Error('Data source not found');
    mockDatasourceSrv.get.mockRejectedValue(error);

    const { result } = renderHook(() => useDataSourceInstance('missing'));

    await waitFor(() => expect(result.current).toEqual({ isLoading: false, error }));
  });

  it('should re-resolve when the ref changes', async () => {
    mockDatasourceSrv.get.mockImplementation(async (uid: string) => (uid === 'ds-a' ? alpha : bravo));
    const { result, rerender } = renderHook(({ ref }) => useDataSourceInstance(ref), {
      initialProps: { ref: 'ds-a' },
    });
    await waitFor(() => expect(result.current.dataSource).toBe(alpha));

    rerender({ ref: 'ds-b' });

    await waitFor(() => expect(result.current.dataSource).toBe(bravo));
    expect(mockDatasourceSrv.get).toHaveBeenCalledTimes(2);
  });

  it('should not refetch when an equal inline ref object is passed', async () => {
    mockDatasourceSrv.get.mockResolvedValue(alpha);
    const { result, rerender } = renderHook(({ ref }) => useDataSourceInstance(ref), {
      initialProps: { ref: { uid: 'ds-a', type: 'loki' } },
    });
    await waitFor(() => expect(result.current.dataSource).toBe(alpha));

    rerender({ ref: { uid: 'ds-a', type: 'loki' } });

    expect(result.current.dataSource).toBe(alpha);
    expect(mockDatasourceSrv.get).toHaveBeenCalledTimes(1);
  });

  it('should ignore the result of a stale ref that resolves after the current one', async () => {
    const slowAlpha = deferred<DataSourceApi>();
    mockDatasourceSrv.get.mockImplementation((uid: string) =>
      uid === 'ds-a' ? slowAlpha.promise : Promise.resolve(bravo)
    );
    const { result, rerender } = renderHook(({ ref }) => useDataSourceInstance(ref), {
      initialProps: { ref: 'ds-a' },
    });

    rerender({ ref: 'ds-b' });
    await waitFor(() => expect(result.current.dataSource).toBe(bravo));
    await act(async () => slowAlpha.resolve(alpha));

    expect(result.current).toEqual({ isLoading: false, dataSource: bravo });
  });
});
