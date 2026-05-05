import { act, renderHook, waitFor } from '@testing-library/react';

import { SortOrder } from 'app/core/utils/richHistoryTypes';
import { type RichHistoryQuery } from 'app/types/explore';

import { getStoredFilterDefaults, storeFilterDefaults } from './filterDefaults';
import { useRecentQueriesData } from './useRecentQueriesData';

const { getRichHistory, getRichHistorySettings } = jest.requireMock('app/core/utils/richHistory');

jest.mock('app/core/utils/richHistory', () => ({
  getRichHistory: jest.fn(),
  getRichHistorySettings: jest.fn(),
}));

jest.mock('./filterDefaults', () => ({
  getStoredFilterDefaults: jest.fn(),
  storeFilterDefaults: jest.fn(),
}));

const makeQuery = (overrides: Partial<RichHistoryQuery> = {}): RichHistoryQuery => ({
  id: '1',
  createdAt: 1000,
  datasourceUid: 'prom-uid',
  datasourceName: 'prometheus',
  starred: false,
  comment: '',
  queries: [{ refId: 'A' }],
  ...overrides,
});

const defaultSettings = { retentionPeriod: 14, starredTabAsFirstTab: false, activeDatasourcesOnly: false };

const renderAndSettle = async (activeDatasources?: string[]) => {
  const result = renderHook(() => useRecentQueriesData(activeDatasources));
  await act(async () => {});
  return result;
};

describe('useRecentQueriesData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getRichHistorySettings as jest.Mock).mockResolvedValue(defaultSettings);
    (getRichHistory as jest.Mock).mockResolvedValue({ richHistory: [makeQuery()], total: 1 });
    (getStoredFilterDefaults as jest.Mock).mockReturnValue({});
  });

  it('returns default filter state on first render', async () => {
    const { result } = await renderAndSettle();
    expect(result.current.filters.showStarredOnly).toBe(false);
    expect(result.current.filters.searchQuery).toBe('');
    expect(result.current.filters.datasourceFilters).toEqual([]);
    expect(result.current.filters.sortingOption.value).toBe(SortOrder.Descending);
    expect(result.current.filters.rememberFilters).toBe(false);
  });

  it('returns isLoading=true before settings and queries load', async () => {
    let resolveSettings: (v: unknown) => void;
    (getRichHistorySettings as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveSettings = resolve;
      })
    );
    (getRichHistory as jest.Mock).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useRecentQueriesData());
    expect(result.current.isLoading).toBe(true);

    await act(async () => resolveSettings(defaultSettings));
  });

  it('returns isLoading=false once queries load', async () => {
    const { result } = await renderAndSettle();
    expect(result.current.isLoading).toBe(false);
  });

  it('fetches queries with correctly mapped params', async () => {
    await renderAndSettle();
    await waitFor(() => {
      expect(getRichHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          search: '',
          sortOrder: SortOrder.Descending,
          datasourceFilters: [],
          starred: false,
          from: 0,
          to: 14,
          page: 1,
        })
      );
    });
  });

  it('does not fetch queries until settings are loaded', async () => {
    (getRichHistorySettings as jest.Mock).mockReturnValue(new Promise(() => {}));
    await renderAndSettle();
    expect(getRichHistory).not.toHaveBeenCalled();
  });

  it('returns queries and totalQueries from the fetch result', async () => {
    (getRichHistory as jest.Mock).mockResolvedValue({
      richHistory: [makeQuery(), makeQuery({ id: '2' })],
      total: 5,
    });
    const { result } = await renderAndSettle();
    await waitFor(() => {
      expect(result.current.queries).toHaveLength(2);
      expect(result.current.totalQueries).toBe(5);
    });
  });

  it('returns error when getRichHistory rejects', async () => {
    (getRichHistory as jest.Mock).mockRejectedValue(new Error('Network error'));
    const { result } = await renderAndSettle();
    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
      expect((result.current.error as Error).message).toBe('Network error');
    });
  });

  it('setFilters merges partial updates without replacing other fields', async () => {
    const { result } = await renderAndSettle();
    await act(async () => result.current.setFilters({ searchQuery: 'hello' }));
    expect(result.current.filters.searchQuery).toBe('hello');
    expect(result.current.filters.showStarredOnly).toBe(false);
  });

  it('filter change resets page and replaces results', async () => {
    const page1Queries = [makeQuery({ id: '1' })];
    const page2Queries = [makeQuery({ id: '2' })];
    const afterFilterQueries = [makeQuery({ id: '3' })];

    (getRichHistory as jest.Mock)
      .mockResolvedValueOnce({ richHistory: page1Queries, total: 3 })
      .mockResolvedValueOnce({ richHistory: page2Queries, total: 3 })
      .mockResolvedValueOnce({ richHistory: afterFilterQueries, total: 1 });

    const { result } = await renderAndSettle();
    await waitFor(() => expect(result.current.queries).toHaveLength(1));

    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.queries).toHaveLength(2));

    await act(async () => result.current.setFilters({ searchQuery: 'new search' }));
    await waitFor(() => {
      expect(result.current.queries).toHaveLength(1);
      expect(result.current.queries[0].id).toBe('3');
    });
  });

  it('loadMore increments page and appends results', async () => {
    const page1Queries = [makeQuery({ id: '1' })];
    const page2Queries = [makeQuery({ id: '2' })];

    (getRichHistory as jest.Mock)
      .mockResolvedValueOnce({ richHistory: page1Queries, total: 2 })
      .mockResolvedValueOnce({ richHistory: page2Queries, total: 2 });

    const { result } = await renderAndSettle();
    await waitFor(() => expect(result.current.queries).toHaveLength(1));

    await act(async () => result.current.loadMore());

    await waitFor(() => {
      expect(result.current.queries).toHaveLength(2);
      expect(result.current.queries[0].id).toBe('1');
      expect(result.current.queries[1].id).toBe('2');
    });
  });

  it('restores stored filter defaults when rememberFilters was true', async () => {
    (getStoredFilterDefaults as jest.Mock).mockReturnValue({
      rememberFilters: true,
      searchQuery: 'stored-query',
    });
    const { result } = renderHook(() => useRecentQueriesData());
    await waitFor(() => expect(result.current.filters.searchQuery).toBe('stored-query'));
  });

  it('does not restore stored defaults when rememberFilters was false', async () => {
    (getStoredFilterDefaults as jest.Mock).mockReturnValue({
      rememberFilters: false,
      searchQuery: 'stored-query',
    });
    const { result } = await renderAndSettle();
    expect(result.current.filters.searchQuery).toBe('');
  });

  it('calls storeFilterDefaults on unmount when rememberFilters is on', async () => {
    const { result, unmount } = await renderAndSettle();
    await act(async () => result.current.setFilters({ rememberFilters: true }));
    unmount();
    expect(storeFilterDefaults).toHaveBeenCalledWith('recent', expect.objectContaining({ rememberFilters: true }));
  });

  it('clears stored defaults when rememberFilters is turned off', async () => {
    const { result } = await renderAndSettle();
    await act(async () => result.current.setFilters({ rememberFilters: true }));
    await act(async () => result.current.setFilters({ rememberFilters: false }));
    expect(storeFilterDefaults).toHaveBeenCalledWith('recent', {});
  });

  it('returns settings from getRichHistorySettings', async () => {
    const { result } = await renderAndSettle();
    await waitFor(() => {
      expect(result.current.settings).toEqual(defaultSettings);
    });
  });

  it('uses activeDatasources parameter as initial datasourceFilters', async () => {
    const { result } = await renderAndSettle(['loki']);
    expect(result.current.filters.datasourceFilters).toEqual(['loki']);
  });
});
