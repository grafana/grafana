import { renderHook } from '@testing-library/react';

import { type InfiniteQueryResult, keepFirstPage, usePagedResult } from './pagedQuery';

function fetchError(status: number) {
  return { status, data: { message: 'failed' }, config: { url: '/search' } };
}

function getItems(page: string[]) {
  return page;
}

/** A query whose first page loaded and whose last request failed with `error`. */
function renderFailedQuery({ isFetchNextPageError, error }: { isFetchNextPageError: boolean; error: unknown }) {
  const query: InfiniteQueryResult<string[]> = {
    currentData: { pages: [['a']] },
    isError: true,
    error,
    hasNextPage: true,
    isFetchingNextPage: false,
    isFetchNextPageError,
    fetchNextPage: jest.fn(),
    refetch: jest.fn(),
  };
  const restartFromFirstPage = jest.fn();
  const { result } = renderHook(() => usePagedResult(query, getItems, restartFromFirstPage));
  return { query, restartFromFirstPage, result };
}

describe('usePagedResult', () => {
  it('keeps the loaded items and names a failed next page as a Load more failure', () => {
    const { result } = renderFailedQuery({ isFetchNextPageError: true, error: fetchError(500) });

    expect(result.current.items).toEqual(['a']);
    expect(result.current.error).toBeUndefined();
    expect(result.current.failure).toEqual({ kind: 'load-more', error: fetchError(500) });
  });

  it.each([401, 403, 429, 500, 503])('repeats the failed next page with the same token after HTTP %s', (status) => {
    const { query, restartFromFirstPage, result } = renderFailedQuery({
      isFetchNextPageError: true,
      error: fetchError(status),
    });

    result.current.retry();

    expect(query.fetchNextPage).toHaveBeenCalledTimes(1);
    expect(query.refetch).not.toHaveBeenCalled();
    expect(restartFromFirstPage).not.toHaveBeenCalled();
  });

  it('repeats the failed next page after an error without an HTTP status', () => {
    const { query, restartFromFirstPage, result } = renderFailedQuery({
      isFetchNextPageError: true,
      error: new Error('network down'),
    });

    result.current.retry();

    expect(query.fetchNextPage).toHaveBeenCalledTimes(1);
    expect(restartFromFirstPage).not.toHaveBeenCalled();
  });

  it.each([400, 410, 422])('restarts from the first page after HTTP %s rejected the token', (status) => {
    const { query, restartFromFirstPage, result } = renderFailedQuery({
      isFetchNextPageError: true,
      error: fetchError(status),
    });

    result.current.retry();

    expect(restartFromFirstPage).toHaveBeenCalledTimes(1);
    expect(query.refetch).toHaveBeenCalledTimes(1);
    expect(query.fetchNextPage).not.toHaveBeenCalled();
  });

  it('refetches the loaded pages when that, not a next page, failed', () => {
    const { query, restartFromFirstPage, result } = renderFailedQuery({
      isFetchNextPageError: false,
      error: fetchError(410),
    });

    expect(result.current.failure).toEqual({ kind: 'refresh', error: fetchError(410) });
    result.current.retry();

    expect(query.refetch).toHaveBeenCalledTimes(1);
    expect(query.fetchNextPage).not.toHaveBeenCalled();
    expect(restartFromFirstPage).not.toHaveBeenCalled();
  });
});

describe('keepFirstPage', () => {
  it('drops every page and page parameter after the first', () => {
    const data = { pages: ['a', 'b', 'c'], pageParams: [undefined, 'tok-1', 'tok-2'] };

    keepFirstPage(data);

    expect(data).toEqual({ pages: ['a'], pageParams: [undefined] });
  });
});
