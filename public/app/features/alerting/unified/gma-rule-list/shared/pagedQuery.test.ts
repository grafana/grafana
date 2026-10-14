import { isRejectedContinuation, keepFirstPage, retryPagedQuery } from './pagedQuery';

function fetchError(status: number) {
  return { status, data: { message: 'failed' }, config: { url: '/search' } };
}

describe('isRejectedContinuation', () => {
  it.each([400, 410, 422])('treats HTTP $status as a rejected continuation token', (status) => {
    expect(isRejectedContinuation(fetchError(status))).toBe(true);
  });

  it.each([401, 403, 429, 500, 503])('treats HTTP $status as a failure a repeat can recover from', (status) => {
    expect(isRejectedContinuation(fetchError(status))).toBe(false);
  });

  it('does not treat an error without an HTTP status as a rejected token', () => {
    expect(isRejectedContinuation(new Error('network down'))).toBe(false);
  });
});

describe('retryPagedQuery', () => {
  function setup(overrides: { isFetchNextPageError: boolean; error?: unknown }) {
    const query = { ...overrides, fetchNextPage: jest.fn(), refetch: jest.fn() };
    const restartFromFirstPage = jest.fn();
    retryPagedQuery(query, restartFromFirstPage);
    return { query, restartFromFirstPage };
  }

  it('repeats the failed continuation request with the same token', () => {
    const { query, restartFromFirstPage } = setup({ isFetchNextPageError: true, error: fetchError(500) });

    expect(query.fetchNextPage).toHaveBeenCalledTimes(1);
    expect(query.refetch).not.toHaveBeenCalled();
    expect(restartFromFirstPage).not.toHaveBeenCalled();
  });

  it('restarts from the first page when the continuation token was rejected', () => {
    const { query, restartFromFirstPage } = setup({ isFetchNextPageError: true, error: fetchError(410) });

    expect(restartFromFirstPage).toHaveBeenCalledTimes(1);
    expect(query.refetch).toHaveBeenCalledTimes(1);
    expect(query.fetchNextPage).not.toHaveBeenCalled();
  });

  it('refetches the loaded pages when that, not a next page, failed', () => {
    const { query, restartFromFirstPage } = setup({ isFetchNextPageError: false, error: fetchError(410) });

    expect(query.refetch).toHaveBeenCalledTimes(1);
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
