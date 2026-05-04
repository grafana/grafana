import { act, render, screen, waitFor } from '@testing-library/react';

import { type RichHistoryQuery } from 'app/types/explore';

import {
  deleteAllFromRichHistory,
  deleteQueryInRichHistory,
  getRichHistory,
  getRichHistorySettings,
  updateCommentInRichHistory,
  updateRichHistorySettings,
  updateStarredInRichHistory,
} from '../../../core/utils/richHistory';

import { type RecentQueriesContextType, RecentQueriesProvider, useRecentQueriesContext } from './RecentQueriesContext';

jest.mock('app/core/utils/richHistory');
jest.mock('app/core/history/richHistoryStorageProvider', () => ({
  supportedFeatures: () => ({
    availableFilters: [],
    lastUsedDataSourcesAvailable: false,
    clearHistory: true,
    onlyActiveDataSource: false,
    changeRetention: true,
    queryHistoryAvailable: true,
  }),
}));

const mockGetRichHistory = jest.mocked(getRichHistory);
const mockGetRichHistorySettings = jest.mocked(getRichHistorySettings);
const mockUpdateStarred = jest.mocked(updateStarredInRichHistory);
const mockDeleteQuery = jest.mocked(deleteQueryInRichHistory);
const mockUpdateComment = jest.mocked(updateCommentInRichHistory);
const mockDeleteAll = jest.mocked(deleteAllFromRichHistory);
const mockUpdateSettings = jest.mocked(updateRichHistorySettings);

function makeQuery(overrides: Partial<RichHistoryQuery> = {}): RichHistoryQuery {
  return {
    id: 'q1',
    createdAt: Date.now(),
    datasourceUid: 'ds1',
    datasourceName: 'Prometheus',
    starred: false,
    comment: '',
    queries: [{ refId: 'A' }],
    ...overrides,
  };
}

/**
 * Consumer component that renders context values and exposes the context
 * ref so tests can call operations directly inside act().
 */
function TestConsumer({ ctxRef }: { ctxRef: { current: RecentQueriesContextType | undefined } }) {
  const ctx = useRecentQueriesContext();
  ctxRef.current = ctx;
  return (
    <div>
      <span data-testid="queries">{JSON.stringify(ctx.queries)}</span>
      <span data-testid="totalQueries">{ctx.totalQueries}</span>
      <span data-testid="isLoading">{String(ctx.isLoading)}</span>
      <span data-testid="selectedQuery">{JSON.stringify(ctx.selectedQuery)}</span>
      <span data-testid="filters">{JSON.stringify(ctx.filters)}</span>
      <span data-testid="settings">{JSON.stringify(ctx.settings)}</span>
    </div>
  );
}

function renderWithProvider() {
  const ctxRef: { current: RecentQueriesContextType | undefined } = { current: undefined };
  render(
    <RecentQueriesProvider>
      <TestConsumer ctxRef={ctxRef} />
    </RecentQueriesProvider>
  );
  return ctxRef;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetRichHistorySettings.mockResolvedValue({
    retentionPeriod: 14,
    starredTabAsFirstTab: false,
    activeDatasourcesOnly: false,
  });
  mockGetRichHistory.mockResolvedValue({ richHistory: [], total: 0 });
});

describe('RecentQueriesContext', () => {
  it('provides default state with empty queries', async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('queries')).toHaveTextContent('[]');
      expect(screen.getByTestId('totalQueries')).toHaveTextContent('0');
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      expect(screen.getByTestId('selectedQuery')).toHaveTextContent('null');
    });
  });

  it('loads queries via getRichHistory and updates state', async () => {
    const q1 = makeQuery({ id: 'q1' });
    const q2 = makeQuery({ id: 'q2' });
    mockGetRichHistory.mockResolvedValue({ richHistory: [q1, q2], total: 10 });

    const ctxRef = renderWithProvider();
    await waitFor(() => expect(mockGetRichHistorySettings).toHaveBeenCalled());

    await act(async () => {
      await ctxRef.current!.loadQueries();
    });

    await waitFor(() => {
      const queries = JSON.parse(screen.getByTestId('queries').textContent!);
      expect(queries).toHaveLength(2);
      expect(queries[0].id).toBe('q1');
      expect(queries[1].id).toBe('q2');
      expect(screen.getByTestId('totalQueries')).toHaveTextContent('10');
    });
  });

  it('merges partial filters and resets page to 1', async () => {
    const ctxRef = renderWithProvider();
    await waitFor(() => expect(mockGetRichHistorySettings).toHaveBeenCalled());

    act(() => {
      ctxRef.current!.updateFilters({ search: 'test', datasourceFilters: ['Prometheus'] });
    });

    await waitFor(() => {
      const filters = JSON.parse(screen.getByTestId('filters').textContent!);
      expect(filters.search).toBe('test');
      expect(filters.datasourceFilters).toEqual(['Prometheus']);
      expect(filters.page).toBe(1);
      expect(filters.starred).toBe(false);
    });
  });

  it('updates starred status in queries list', async () => {
    const q1 = makeQuery({ id: 'q1', starred: false });
    mockGetRichHistory.mockResolvedValue({ richHistory: [q1], total: 1 });
    mockUpdateStarred.mockResolvedValue({ ...q1, starred: true });

    const ctxRef = renderWithProvider();
    await waitFor(() => expect(mockGetRichHistorySettings).toHaveBeenCalled());

    await act(async () => {
      await ctxRef.current!.loadQueries();
    });

    await waitFor(() => {
      const queries = JSON.parse(screen.getByTestId('queries').textContent!);
      expect(queries[0].starred).toBe(false);
    });

    await act(async () => {
      await ctxRef.current!.starQuery('q1', true);
    });

    await waitFor(() => {
      expect(mockUpdateStarred).toHaveBeenCalledWith('q1', true);
      const queries = JSON.parse(screen.getByTestId('queries').textContent!);
      expect(queries[0].starred).toBe(true);
    });
  });

  it('removes query from list on delete and clears selection if deleted query was selected', async () => {
    const q1 = makeQuery({ id: 'q1' });
    mockGetRichHistory.mockResolvedValue({ richHistory: [q1], total: 1 });
    mockDeleteQuery.mockResolvedValue('q1');

    const ctxRef = renderWithProvider();
    await waitFor(() => expect(mockGetRichHistorySettings).toHaveBeenCalled());

    await act(async () => {
      await ctxRef.current!.loadQueries();
    });

    act(() => {
      ctxRef.current!.selectQuery(makeQuery({ id: 'q1' }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('selectedQuery')).not.toHaveTextContent('null');
    });

    await act(async () => {
      await ctxRef.current!.deleteQuery('q1');
    });

    await waitFor(() => {
      expect(mockDeleteQuery).toHaveBeenCalledWith('q1');
      const queries = JSON.parse(screen.getByTestId('queries').textContent!);
      expect(queries).toHaveLength(0);
      expect(screen.getByTestId('totalQueries')).toHaveTextContent('0');
      expect(screen.getByTestId('selectedQuery')).toHaveTextContent('null');
    });
  });

  it('clears all queries and resets selection on deleteAll', async () => {
    const q1 = makeQuery({ id: 'q1' });
    mockGetRichHistory.mockResolvedValue({ richHistory: [q1], total: 1 });
    mockDeleteAll.mockResolvedValue(undefined);

    const ctxRef = renderWithProvider();
    await waitFor(() => expect(mockGetRichHistorySettings).toHaveBeenCalled());

    await act(async () => {
      await ctxRef.current!.loadQueries();
    });

    act(() => {
      ctxRef.current!.selectQuery(makeQuery({ id: 'q1' }));
    });

    await waitFor(() => {
      const queries = JSON.parse(screen.getByTestId('queries').textContent!);
      expect(queries).toHaveLength(1);
    });

    await act(async () => {
      await ctxRef.current!.deleteAll();
    });

    await waitFor(() => {
      expect(mockDeleteAll).toHaveBeenCalled();
      const queries = JSON.parse(screen.getByTestId('queries').textContent!);
      expect(queries).toHaveLength(0);
      expect(screen.getByTestId('totalQueries')).toHaveTextContent('0');
      expect(screen.getByTestId('selectedQuery')).toHaveTextContent('null');
    });
  });

  it('loads settings on mount and updates filters.to to match retentionPeriod', async () => {
    mockGetRichHistorySettings.mockResolvedValue({
      retentionPeriod: 7,
      starredTabAsFirstTab: true,
      activeDatasourcesOnly: false,
    });

    renderWithProvider();

    await waitFor(() => {
      const settings = JSON.parse(screen.getByTestId('settings').textContent!);
      expect(settings.retentionPeriod).toBe(7);
      expect(settings.starredTabAsFirstTab).toBe(true);

      const filters = JSON.parse(screen.getByTestId('filters').textContent!);
      expect(filters.to).toBe(7);
    });
  });

  it('appends results on loadMore and increments page', async () => {
    const q1 = makeQuery({ id: 'q1' });
    const q2 = makeQuery({ id: 'q2' });

    // First load
    mockGetRichHistory.mockResolvedValueOnce({ richHistory: [q1], total: 2 });
    // loadMore
    mockGetRichHistory.mockResolvedValueOnce({ richHistory: [q2], total: 2 });

    const ctxRef = renderWithProvider();
    await waitFor(() => expect(mockGetRichHistorySettings).toHaveBeenCalled());

    await act(async () => {
      await ctxRef.current!.loadQueries();
    });

    await waitFor(() => {
      const queries = JSON.parse(screen.getByTestId('queries').textContent!);
      expect(queries).toHaveLength(1);
    });

    await act(async () => {
      await ctxRef.current!.loadMore();
    });

    await waitFor(() => {
      const queries = JSON.parse(screen.getByTestId('queries').textContent!);
      expect(queries).toHaveLength(2);
      expect(queries[0].id).toBe('q1');
      expect(queries[1].id).toBe('q2');
    });

    expect(mockGetRichHistory).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });

  it('updates comment in queries list', async () => {
    const q1 = makeQuery({ id: 'q1', comment: '' });
    mockGetRichHistory.mockResolvedValue({ richHistory: [q1], total: 1 });
    mockUpdateComment.mockResolvedValue({ ...q1, comment: 'new comment' });

    const ctxRef = renderWithProvider();
    await waitFor(() => expect(mockGetRichHistorySettings).toHaveBeenCalled());

    await act(async () => {
      await ctxRef.current!.loadQueries();
    });

    await act(async () => {
      await ctxRef.current!.updateComment('q1', 'new comment');
    });

    await waitFor(() => {
      expect(mockUpdateComment).toHaveBeenCalledWith('q1', 'new comment');
      const queries = JSON.parse(screen.getByTestId('queries').textContent!);
      expect(queries[0].comment).toBe('new comment');
    });
  });

  it('updates settings optimistically', async () => {
    mockUpdateSettings.mockResolvedValue(undefined);

    const ctxRef = renderWithProvider();
    await waitFor(() => expect(mockGetRichHistorySettings).toHaveBeenCalled());

    await act(async () => {
      await ctxRef.current!.updateSettings({ retentionPeriod: 7, starredTabAsFirstTab: true });
    });

    await waitFor(() => {
      const settings = JSON.parse(screen.getByTestId('settings').textContent!);
      expect(settings.retentionPeriod).toBe(7);
      expect(settings.starredTabAsFirstTab).toBe(true);
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          retentionPeriod: 7,
          starredTabAsFirstTab: true,
          activeDatasourcesOnly: false,
        })
      );
    });
  });
});
