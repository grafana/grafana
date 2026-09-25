import { TRASH_PAGE_SIZE, initialTrashState, trashHasMore, trashReducer } from './trashPagination';

function items(count: number, prefix = 'item'): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}-${i}`);
}

describe('trashReducer', () => {
  it('ADEL-2/RDEL-2: shows only the first 40 rows when the response is oversized, keeping the rest local', () => {
    let state = trashReducer(initialTrashState<string>(), { type: 'requestInitial' });
    expect(state.pendingFetch).toEqual({ isInitial: true, continueToken: undefined, requestId: 1 });

    // Legacy storage ignores `limit` and returns every tombstone (65) in one response, with no continue token.
    state = trashReducer(state, {
      type: 'fetchSuccess',
      requestId: 1,
      isInitial: true,
      result: { items: items(65), continueToken: undefined },
    });

    expect(state.rows).toHaveLength(TRASH_PAGE_SIZE);
    expect(state.rows).toEqual(items(65).slice(0, 40));
    expect(state.localBuffer).toEqual(items(65).slice(40));
    expect(trashHasMore(state)).toBe(true);
  });

  it('ADEL-2/RDEL-2: Load more reveals the next local chunk without any network request', () => {
    let state = trashReducer(initialTrashState<string>(), { type: 'requestInitial' });
    state = trashReducer(state, {
      type: 'fetchSuccess',
      requestId: 1,
      isInitial: true,
      result: { items: items(65), continueToken: undefined },
    });

    state = trashReducer(state, { type: 'requestMore' });

    // The buffer alone satisfied the request: no pendingFetch was set (i.e. no new fetch was triggered).
    expect(state.pendingFetch).toBeUndefined();
    expect(state.rows).toHaveLength(65);
    expect(state.rows).toEqual(items(65));
    expect(state.localBuffer).toEqual([]);
    expect(trashHasMore(state)).toBe(false);
  });

  it('ADEL-2/RDEL-2: with a metadata.continue token and an empty buffer, Load more requests the next page', () => {
    let state = trashReducer(initialTrashState<string>(), { type: 'requestInitial' });
    // Unified Storage honors limit=40 exactly and returns a continue token.
    state = trashReducer(state, {
      type: 'fetchSuccess',
      requestId: 1,
      isInitial: true,
      result: { items: items(40), continueToken: 'page-2-token' },
    });
    expect(state.localBuffer).toEqual([]);
    expect(trashHasMore(state)).toBe(true);

    state = trashReducer(state, { type: 'requestMore' });

    expect(state.pendingFetch).toEqual({ isInitial: false, continueToken: 'page-2-token', requestId: 2 });
    expect(state.isLoadingMore).toBe(true);

    state = trashReducer(state, {
      type: 'fetchSuccess',
      requestId: 2,
      isInitial: false,
      result: { items: items(40, 'page2'), continueToken: undefined },
    });

    expect(state.rows).toHaveLength(80);
    expect(state.rows.slice(40)).toEqual(items(40, 'page2'));
    expect(trashHasMore(state)).toBe(false);
  });

  it('ADEL-2/RDEL-2: never issues a second request while one is already in flight', () => {
    let state = trashReducer(initialTrashState<string>(), { type: 'requestInitial' });
    state = trashReducer(state, {
      type: 'fetchSuccess',
      requestId: 1,
      isInitial: true,
      result: { items: items(40), continueToken: 'token' },
    });

    const afterFirstRequestMore = trashReducer(state, { type: 'requestMore' });
    expect(afterFirstRequestMore.pendingFetch).toBeDefined();

    // A second `requestMore` while the first is still pending must be a no-op.
    const afterSecondRequestMore = trashReducer(afterFirstRequestMore, { type: 'requestMore' });
    expect(afterSecondRequestMore).toBe(afterFirstRequestMore);
  });

  it('ADEL-2/RDEL-2: refresh discards the local buffer and continuation state and starts again', () => {
    let state = trashReducer(initialTrashState<string>(), { type: 'requestInitial' });
    state = trashReducer(state, {
      type: 'fetchSuccess',
      requestId: 1,
      isInitial: true,
      result: { items: items(65), continueToken: 'stale-token' },
    });
    expect(state.rows.length).toBeGreaterThan(0);

    state = trashReducer(state, { type: 'requestInitial' });

    expect(state.rows).toEqual([]);
    expect(state.localBuffer).toEqual([]);
    expect(state.continueToken).toBeUndefined();
    expect(state.pendingFetch).toEqual({ isInitial: true, continueToken: undefined, requestId: 2 });
  });

  it('ADEL-2/RDEL-2: a stale fetchSuccess from a superseded request is dropped after refresh', () => {
    let state = trashReducer(initialTrashState<string>(), { type: 'requestInitial' }); // requestId 1
    state = trashReducer(state, { type: 'requestInitial' }); // requestId 2, discards request 1
    expect(state.requestId).toBe(2);

    // The old request 1 finally resolves - its result must not be applied.
    const afterStaleResponse = trashReducer(state, {
      type: 'fetchSuccess',
      requestId: 1,
      isInitial: true,
      result: { items: items(5), continueToken: undefined },
    });

    expect(afterStaleResponse).toBe(state);
  });

  it('ADEL-4/RDEL-4: an initial failure surfaces an error without any rows', () => {
    let state = trashReducer(initialTrashState<string>(), { type: 'requestInitial' });
    state = trashReducer(state, { type: 'fetchError', requestId: 1, isInitial: true, error: new Error('boom') });

    expect(state.status).toBe('error');
    expect(state.rows).toEqual([]);
  });

  it('ADEL-4/RDEL-4: a Load more failure keeps previously loaded rows visible and records a non-blocking error', () => {
    let state = trashReducer(initialTrashState<string>(), { type: 'requestInitial' });
    state = trashReducer(state, {
      type: 'fetchSuccess',
      requestId: 1,
      isInitial: true,
      result: { items: items(40), continueToken: 'token' },
    });
    state = trashReducer(state, { type: 'requestMore' });
    state = trashReducer(state, { type: 'fetchError', requestId: 2, isInitial: false, error: new Error('boom') });

    expect(state.rows).toHaveLength(40);
    expect(state.status).toBe('loaded');
    expect(state.loadMoreError).toBeInstanceOf(Error);
    expect(state.pendingFetch).toBeUndefined();
  });
});
