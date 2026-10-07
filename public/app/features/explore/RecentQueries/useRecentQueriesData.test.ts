import { act, renderHook, waitFor } from '@testing-library/react';

import { SortOrder } from 'app/core/utils/richHistoryTypes';
import { type RichHistoryQuery } from 'app/types/explore';

import { getStoredFilterDefaults, storeFilterDefaults } from './filterDefaults';
import { useRecentQueriesData } from './useRecentQueriesData';

const { getRichHistory, getRichHistorySettings, updateStarredInRichHistory } =
  jest.requireMock('app/core/utils/richHistory');

jest.mock('app/core/utils/richHistory', () => ({
  getRichHistory: jest.fn(),
  getRichHistorySettings: jest.fn(),
  updateStarredInRichHistory: jest.fn(),
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

const renderAndSettle = async () => {
  const result = renderHook(() => useRecentQueriesData());
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
        })
      );
    });
  });

  it('does not fetch queries until settings are loaded', async () => {
    (getRichHistorySettings as jest.Mock).mockReturnValue(new Promise(() => {}));
    await renderAndSettle();
    expect(getRichHistory).not.toHaveBeenCalled();
  });

  it('returns queries from the fetch result', async () => {
    (getRichHistory as jest.Mock).mockResolvedValue({
      richHistory: [makeQuery(), makeQuery({ id: '2' })],
      total: 5,
    });
    const { result } = await renderAndSettle();
    await waitFor(() => {
      expect(result.current.queries).toHaveLength(2);
    });
  });

  it('updates a query optimistically when starred without refetching', async () => {
    (getRichHistory as jest.Mock).mockResolvedValue({
      richHistory: [makeQuery({ id: '1', starred: false })],
      total: 1,
    });
    (updateStarredInRichHistory as jest.Mock).mockResolvedValue([]);
    const { result } = await renderAndSettle();
    await waitFor(() => expect(result.current.queries).toHaveLength(1));

    (getRichHistory as jest.Mock).mockClear();
    await act(async () => result.current.starQuery('1', true));

    expect(result.current.queries[0].starred).toBe(true);
    expect(getRichHistory).not.toHaveBeenCalled();
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
  });

  it('replaces results with the latest fetch on filter change', async () => {
    const initialQueries = [makeQuery({ id: '1' })];
    const afterFilterQueries = [makeQuery({ id: '2' }), makeQuery({ id: '3' })];

    // When showing "All", the hook fetches in-range queries plus all starred queries
    // and merges them. Drive the in-range result by the search filter; no starred queries here.
    (getRichHistory as jest.Mock).mockImplementation(({ starred, search }) => {
      if (starred) {
        return Promise.resolve({ richHistory: [], total: 0 });
      }
      return search === 'new search'
        ? Promise.resolve({ richHistory: afterFilterQueries, total: 2 })
        : Promise.resolve({ richHistory: initialQueries, total: 1 });
    });

    const { result } = await renderAndSettle();
    await waitFor(() => {
      expect(result.current.queries).toHaveLength(1);
      expect(result.current.queries[0].id).toBe('1');
    });

    await act(async () => result.current.setFilters({ searchQuery: 'new search' }));
    await waitFor(() => {
      expect(result.current.queries).toHaveLength(2);
      expect(result.current.queries.map((q) => q.id)).toEqual(['2', '3']);
    });
  });

  it('merges starred queries outside the retention range into the "All" results', async () => {
    const inRange = [makeQuery({ id: '1', createdAt: 2000 })];
    // Starred query older than the retention window — only returned by the unbounded starred fetch.
    const oldStarred = makeQuery({ id: '99', createdAt: 1, starred: true });

    (getRichHistory as jest.Mock).mockImplementation(({ starred }) =>
      starred
        ? Promise.resolve({ richHistory: [oldStarred], total: 1 })
        : Promise.resolve({ richHistory: inRange, total: 1 })
    );

    const { result } = await renderAndSettle();

    await waitFor(() => {
      // Both the in-range query and the out-of-range starred query are present, newest first.
      expect(result.current.queries.map((q) => q.id)).toEqual(['1', '99']);
    });

    // "All" issues both an in-range (time-bounded) fetch and an unbounded starred fetch.
    expect(getRichHistory).toHaveBeenCalledWith(expect.objectContaining({ starred: false, from: 0, to: 14 }));
    const starredCall = (getRichHistory as jest.Mock).mock.calls.find(([args]) => args.starred === true)?.[0];
    expect(starredCall).toEqual(expect.objectContaining({ starred: true }));
    expect(starredCall.from).toBeUndefined();
    expect(starredCall.to).toBeUndefined();
  });

  it('de-duplicates starred queries that are also within range', async () => {
    const starredInRange = makeQuery({ id: '5', createdAt: 3000, starred: true });

    // The same query comes back from both the in-range and starred fetches.
    (getRichHistory as jest.Mock).mockResolvedValue({ richHistory: [starredInRange], total: 1 });

    const { result } = await renderAndSettle();

    await waitFor(() => {
      expect(result.current.queries).toHaveLength(1);
      expect(result.current.queries[0].id).toBe('5');
    });
  });

  it('still shows in-range results when the supplementary starred fetch fails', async () => {
    const inRange = [makeQuery({ id: '1', createdAt: 2000 })];

    (getRichHistory as jest.Mock).mockImplementation(({ starred }) =>
      starred ? Promise.reject(new Error('starred fetch failed')) : Promise.resolve({ richHistory: inRange, total: 1 })
    );

    const { result } = await renderAndSettle();

    await waitFor(() => {
      expect(result.current.queries.map((q) => q.id)).toEqual(['1']);
    });
    expect(result.current.error).toBeUndefined();
  });

  it('issues a single unbounded fetch when showing starred only', async () => {
    const { result } = await renderAndSettle();
    (getRichHistory as jest.Mock).mockClear();

    await act(async () => result.current.setFilters({ showStarredOnly: true }));

    await waitFor(() => {
      expect(getRichHistory).toHaveBeenCalledTimes(1);
    });
    const call = (getRichHistory as jest.Mock).mock.calls[0][0];
    expect(call).toEqual(expect.objectContaining({ starred: true }));
    expect(call.from).toBeUndefined();
    expect(call.to).toBeUndefined();
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

  it('debounces search before fetching', async () => {
    jest.useFakeTimers();
    try {
      const getRichHistoryMock = getRichHistory as jest.Mock;

      const { result } = renderHook(() => useRecentQueriesData());
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      getRichHistoryMock.mockClear();

      act(() => result.current.setFilters({ searchQuery: 'a' }));
      act(() => result.current.setFilters({ searchQuery: 'ab' }));
      act(() => result.current.setFilters({ searchQuery: 'abc' }));

      expect(result.current.filters.searchQuery).toBe('abc');
      expect(getRichHistoryMock).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      // "All" fires two fetches per settled change (in-range + unbounded starred), but only once
      // after the debounce settles — not once per intermediate keystroke.
      expect(getRichHistoryMock).toHaveBeenCalledTimes(2);
      expect(getRichHistoryMock).toHaveBeenCalledWith(expect.objectContaining({ search: 'abc', starred: false }));
      expect(getRichHistoryMock).toHaveBeenCalledWith(expect.objectContaining({ search: 'abc', starred: true }));
    } finally {
      jest.useRealTimers();
    }
  });
});
