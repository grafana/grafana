import { renderHook, waitFor } from '@testing-library/react';

import { setDataSourceSrv } from '@grafana/runtime';

import { getMockedDatasourceSrv, getMockedListItem } from '../utils/mocks';

import { type GetDataSourceInstanceListFilters } from './types';
import { useDataSourceInstanceList } from './useDataSourceInstanceList';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceList: undefined,
  useDataSourceInstanceList: undefined,
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceInstanceList: undefined,
  useDataSourceInstanceList: undefined,
}));

const mockDatasourceSrv = getMockedDatasourceSrv();

const alpha = getMockedListItem({ uid: 'ds-a', type: 'loki', name: 'A' });
const bravo = getMockedListItem({ uid: 'ds-b', type: 'tempo', name: 'B' });

describe('useDataSourceInstanceList', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setDataSourceSrv(mockDatasourceSrv);
    mockDatasourceSrv.getList.mockReturnValue([alpha, bravo]);
  });

  it('should be loading until the list resolves', async () => {
    const { result } = renderHook(() => useDataSourceInstanceList());

    expect(result.current).toEqual({ isLoading: true, items: [] });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.map((item) => item.uid)).toEqual(['ds-a', 'ds-b']);
  });

  it('should return an empty list and the error when the list fails', async () => {
    const error = new Error('List failed');
    mockDatasourceSrv.getList.mockImplementation(() => {
      throw error;
    });

    const { result } = renderHook(() => useDataSourceInstanceList());

    await waitFor(() => expect(result.current).toEqual({ isLoading: false, error, items: [] }));
  });

  it('should fetch again when the filters change by value', async () => {
    const { result, rerender } = renderHook(({ filters }) => useDataSourceInstanceList(filters), {
      initialProps: { filters: { type: 'loki' } as GetDataSourceInstanceListFilters },
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({ filters: { type: 'tempo' } });

    await waitFor(() => expect(mockDatasourceSrv.getList).toHaveBeenCalledTimes(2));
    expect(mockDatasourceSrv.getList).toHaveBeenLastCalledWith({ type: 'tempo' });
  });

  it('should not fetch again when an equal inline filters object is passed', async () => {
    const { result, rerender } = renderHook(({ filters }) => useDataSourceInstanceList(filters), {
      initialProps: { filters: { type: ['loki', 'tempo'] } as GetDataSourceInstanceListFilters },
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({ filters: { type: ['loki', 'tempo'] } });

    expect(result.current.isLoading).toBe(false);
    expect(mockDatasourceSrv.getList).toHaveBeenCalledTimes(1);
  });

  it('should fetch again when the filter function reference changes', async () => {
    const { result, rerender } = renderHook(({ filters }) => useDataSourceInstanceList(filters), {
      initialProps: { filters: { filter: () => true } as GetDataSourceInstanceListFilters },
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({ filters: { filter: () => true } });

    await waitFor(() => expect(mockDatasourceSrv.getList).toHaveBeenCalledTimes(2));
  });

  it('should not fetch again when the same filter function is passed in a new filters object', async () => {
    const filter = () => true;
    const { result, rerender } = renderHook(({ filters }) => useDataSourceInstanceList(filters), {
      initialProps: { filters: { filter } as GetDataSourceInstanceListFilters },
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({ filters: { filter } });

    expect(mockDatasourceSrv.getList).toHaveBeenCalledTimes(1);
  });

  it('should keep the previous items while fetching again', async () => {
    const { result, rerender } = renderHook(({ filters }) => useDataSourceInstanceList(filters), {
      initialProps: { filters: { type: 'loki' } as GetDataSourceInstanceListFilters },
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const previousItems = result.current.items;

    // The legacy `getList` is synchronous, so the new fetch settles only after this synchronous rerender.
    rerender({ filters: { type: 'tempo' } });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.items).toBe(previousItems);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('should return the same items reference across re-renders', async () => {
    const { result, rerender } = renderHook(() => useDataSourceInstanceList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const items = result.current.items;

    rerender();

    expect(result.current.items).toBe(items);
  });
});
