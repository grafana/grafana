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

    (getRichHistory as jest.Mock)
      .mockResolvedValueOnce({ richHistory: initialQueries, total: 1 })
      .mockResolvedValueOnce({ richHistory: afterFilterQueries, total: 2 });

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

      expect(getRichHistoryMock).toHaveBeenCalledTimes(1);
      expect(getRichHistoryMock).toHaveBeenCalledWith(expect.objectContaining({ search: 'abc' }));
    } finally {
      jest.useRealTimers();
    }
  });
});
