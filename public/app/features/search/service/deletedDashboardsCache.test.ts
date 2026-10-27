import { iamAPIv0alpha1, type Display, type DisplayList } from 'app/api/clients/iam/v0alpha1';
import { dispatch } from 'app/types/store';

import { DELETED_DASHBOARDS_LIMIT, deletedDashboardsCache, resolveDeletedByDisplayMap } from './deletedDashboardsCache';
import { fetchTrashPage, type TrashItem } from './trashSearchApi';
import { DELETED_BY_REMOVED, DELETED_BY_UNKNOWN } from './utils';

jest.mock('app/api/clients/iam/v0alpha1', () => ({
  iamAPIv0alpha1: {
    endpoints: {
      getDisplayMapping: {
        initiate: jest.fn(),
      },
    },
  },
}));

jest.mock('app/types/store', () => ({
  ...jest.requireActual('app/types/store'),
  dispatch: jest.fn(),
}));

jest.mock('./trashSearchApi', () => ({
  ...jest.requireActual('./trashSearchApi'),
  fetchTrashPage: jest.fn(),
}));

const mockFetchTrashPage = fetchTrashPage as jest.MockedFunction<typeof fetchTrashPage>;
const mockInitiate = iamAPIv0alpha1.endpoints.getDisplayMapping.initiate as unknown as jest.Mock;
const mockDispatch = dispatch as unknown as jest.Mock;

function makeDisplayList(display: Display[]): DisplayList {
  return {
    display,
    keys: display.map((d) => `${d.identity.type}:${d.identity.name}`),
    metadata: {},
  };
}

type MockResult = { data?: DisplayList; error?: unknown };

// The dispatched RTK Query thunk returns a `QueryActionCreatorResult` — a thenable.
// Production awaits the thenables via `Promise.allSettled`, so tests must return a
// shape that satisfies `PromiseLike`.
function mockSubscription(result: MockResult | Error): PromiseLike<MockResult> {
  return {
    then(onFulfilled, onRejected) {
      if (result instanceof Error) {
        return Promise.reject(result).then(onFulfilled, onRejected);
      }
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
}

describe('resolveDeletedByDisplayMap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInitiate.mockReturnValue('initiate-thunk');
  });

  it('returns an empty map and does not dispatch when given no UIDs', async () => {
    const map = await resolveDeletedByDisplayMap(new Set(), new Map());

    expect(map.size).toBe(0);
    expect(mockInitiate).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('dispatches getDisplayMapping with sorted UIDs and subscribe:false', async () => {
    mockDispatch.mockReturnValue(mockSubscription({ data: makeDisplayList([]) }));

    await resolveDeletedByDisplayMap(new Set(['user:bob', 'user:alice']), new Map());

    expect(mockInitiate).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith('initiate-thunk');
    const [keyArg, optionsArg] = mockInitiate.mock.calls[0] as [{ key: string[] }, { subscribe: boolean }];
    // Keys are sorted before dispatch so equivalent UID sets produce stable RTKQ cache keys.
    expect(keyArg.key).toEqual(['user:alice', 'user:bob']);
    expect(optionsArg).toEqual({ subscribe: false });
  });

  it('skips UIDs already resolved in the cache', async () => {
    const cache = new Map<string, string>([['user:alice', 'Alice']]);

    const map = await resolveDeletedByDisplayMap(new Set(['user:alice']), cache);

    expect(map.get('user:alice')).toBe('Alice');
    expect(mockInitiate).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('dispatches only for the cache-miss subset', async () => {
    mockDispatch.mockReturnValue(
      mockSubscription({
        data: makeDisplayList([{ identity: { type: 'user', name: 'bob' }, displayName: 'Bob' }]),
      })
    );
    const cache = new Map<string, string>([['user:alice', 'Alice']]);

    const map = await resolveDeletedByDisplayMap(new Set(['user:alice', 'user:bob']), cache);

    expect(map.get('user:alice')).toBe('Alice');
    expect(map.get('user:bob')).toBe('Bob');
    const [keyArg] = mockInitiate.mock.calls[0] as [{ key: string[] }];
    expect(keyArg.key).toEqual(['user:bob']);
  });

  it('re-fetches UIDs whose previous lookup yielded DELETED_BY_UNKNOWN', async () => {
    mockDispatch.mockReturnValue(
      mockSubscription({
        data: makeDisplayList([{ identity: { type: 'user', name: 'alice' }, displayName: 'Alice' }]),
      })
    );
    const cache = new Map<string, string>([['user:alice', DELETED_BY_UNKNOWN]]);

    const map = await resolveDeletedByDisplayMap(new Set(['user:alice']), cache);

    expect(map.get('user:alice')).toBe('Alice');
    expect(mockInitiate).toHaveBeenCalledTimes(1);
    expect(cache.get('user:alice')).toBe('Alice');
  });

  it('does not re-fetch UIDs cached as DELETED_BY_REMOVED (terminal state)', async () => {
    const cache = new Map<string, string>([['user:alice', DELETED_BY_REMOVED]]);

    const map = await resolveDeletedByDisplayMap(new Set(['user:alice']), cache);

    expect(map.get('user:alice')).toBe(DELETED_BY_REMOVED);
    expect(mockInitiate).not.toHaveBeenCalled();
  });

  it('writes resolved entries back to the shared cache', async () => {
    mockDispatch.mockReturnValue(
      mockSubscription({
        data: makeDisplayList([{ identity: { type: 'user', name: 'alice' }, displayName: 'Alice' }]),
      })
    );
    const cache = new Map<string, string>();

    await resolveDeletedByDisplayMap(new Set(['user:alice']), cache);

    expect(cache.get('user:alice')).toBe('Alice');
  });

  it('logs and marks UIDs as unknown when RTK Query resolves with an error result', async () => {
    // RTK Query query thunks are `SafePromise`s — on request failure they resolve with
    // an `{ error, data: undefined }` shape rather than rejecting. Production routes the error
    // through `getMessageFromError`, which falls back to `JSON.stringify` for plain objects.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockDispatch.mockReturnValue(mockSubscription({ error: { status: 500, data: 'upstream failure' } }));

    const map = await resolveDeletedByDisplayMap(new Set(['user:alice']), new Map());

    expect(map.get('user:alice')).toBe(DELETED_BY_UNKNOWN);
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to resolve deleted dashboard user displays:',
      expect.stringContaining('500')
    );
    consoleError.mockRestore();
  });

  it('builds a map keyed by identity `type:name`', async () => {
    mockDispatch.mockReturnValue(
      mockSubscription({ data: makeDisplayList([{ identity: { type: 'user', name: 'alice' }, displayName: 'Alice' }]) })
    );

    const map = await resolveDeletedByDisplayMap(new Set(['user:alice']), new Map());

    expect(map.get('user:alice')).toBe('Alice');
  });

  it('additionally caches by String(internalId) when provided', async () => {
    mockDispatch.mockReturnValue(
      mockSubscription({
        data: makeDisplayList([{ identity: { type: 'user', name: 'alice' }, displayName: 'Alice', internalId: 42 }]),
      })
    );
    const cache = new Map<string, string>();

    await resolveDeletedByDisplayMap(new Set(['user:alice']), cache);

    expect(cache.get('user:alice')).toBe('Alice');
    expect(cache.get('42')).toBe('Alice');
    expect(cache.get('user:42')).toBe('Alice');
  });

  it('aliases typed numeric annotations to the canonical entry via `<type>:<internalId>`', async () => {
    // Simulates the case where the annotation is `user:1` but the server
    // canonicalizes to `user:u000000001` plus `internalId: 1`.
    mockDispatch.mockReturnValue(
      mockSubscription({
        data: makeDisplayList([
          { identity: { type: 'user', name: 'u000000001' }, displayName: 'Alice', internalId: 1 },
        ]),
      })
    );
    const cache = new Map<string, string>();

    const map = await resolveDeletedByDisplayMap(new Set(['user:1']), cache);

    expect(map.get('user:1')).toBe('Alice');
    expect(cache.get('user:u000000001')).toBe('Alice');
    expect(cache.get('1')).toBe('Alice');
  });

  it('preserves Unicode display names verbatim', async () => {
    mockDispatch.mockReturnValue(
      mockSubscription({
        data: makeDisplayList([
          { identity: { type: 'user', name: 'tanaka' }, displayName: '田中太郎' },
          { identity: { type: 'user', name: 'mohamed' }, displayName: 'محمد العربي' },
        ]),
      })
    );

    const map = await resolveDeletedByDisplayMap(new Set(['user:tanaka', 'user:mohamed']), new Map());

    expect(map.get('user:tanaka')).toBe('田中太郎');
    expect(map.get('user:mohamed')).toBe('محمد العربي');
  });

  it('marks UIDs the server could not resolve with DELETED_BY_REMOVED', async () => {
    mockDispatch.mockReturnValue(
      mockSubscription({ data: makeDisplayList([{ identity: { type: 'user', name: 'alice' }, displayName: 'Alice' }]) })
    );

    const map = await resolveDeletedByDisplayMap(new Set(['user:alice', 'user:missing']), new Map());

    expect(map.get('user:alice')).toBe('Alice');
    // Successful batch, no IAM entry for user:missing — account was deleted.
    expect(map.get('user:missing')).toBe(DELETED_BY_REMOVED);
  });

  it('marks requested UIDs as DELETED_BY_UNKNOWN when the dispatch resolves with no data', async () => {
    mockDispatch.mockReturnValue(mockSubscription({ data: undefined }));

    const map = await resolveDeletedByDisplayMap(new Set(['user:alice']), new Map());

    // `data === undefined` is treated as batch failure so the UI renders a consistent placeholder
    // rather than a raw UID.
    expect(map.get('user:alice')).toBe(DELETED_BY_UNKNOWN);
  });

  it('marks requested UIDs as DELETED_BY_UNKNOWN and swallows errors when the dispatch rejects', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockDispatch.mockReturnValue(mockSubscription(new Error('boom')));

    const map = await resolveDeletedByDisplayMap(new Set(['user:alice']), new Map());

    expect(map.get('user:alice')).toBe(DELETED_BY_UNKNOWN);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('chunks large UID sets into batches of at most IAM_DISPLAY_BATCH_SIZE keys', async () => {
    // Build 250 unique UIDs; at batch size 200 this must split into 2 dispatches.
    const uids = new Set<string>();
    for (let i = 0; i < 250; i++) {
      uids.add(`user:u${String(i).padStart(4, '0')}`);
    }
    mockDispatch.mockReturnValue(mockSubscription({ data: makeDisplayList([]) }));

    const map = await resolveDeletedByDisplayMap(uids, new Map());

    expect(mockInitiate).toHaveBeenCalledTimes(2);
    const firstBatch = (mockInitiate.mock.calls[0][0] as { key: string[] }).key;
    const secondBatch = (mockInitiate.mock.calls[1][0] as { key: string[] }).key;
    expect(firstBatch.length).toBeLessThanOrEqual(200);
    expect(secondBatch.length).toBeLessThanOrEqual(200);
    expect(firstBatch.length + secondBatch.length).toBe(250);
    // Every requested UID is present in the returned map; unresolved entries get a sentinel.
    for (let i = 0; i < 250; i++) {
      expect(map.get(`user:u${String(i).padStart(4, '0')}`)).toBe(DELETED_BY_REMOVED);
    }
  });

  it('preserves successful batches when a sibling batch fails', async () => {
    // Two batches: first succeeds with a display; second rejects.
    const uids = new Set<string>();
    for (let i = 0; i < 250; i++) {
      uids.add(`user:u${String(i).padStart(4, '0')}`);
    }

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockDispatch
      .mockReturnValueOnce(
        mockSubscription({
          data: makeDisplayList([{ identity: { type: 'user', name: 'u0000' }, displayName: 'Alice' }]),
        })
      )
      .mockReturnValueOnce(mockSubscription(new Error('batch-2 failed')));

    const map = await resolveDeletedByDisplayMap(uids, new Map());

    // First batch's resolved UID: real display name.
    expect(map.get('user:u0000')).toBe('Alice');
    // First batch's unresolved UIDs: DELETED_BY_REMOVED (successful batch, no IAM entry).
    expect(map.get('user:u0001')).toBe(DELETED_BY_REMOVED);
    // Second batch's UIDs: DELETED_BY_UNKNOWN (batch failed).
    expect(map.get('user:u0200')).toBe(DELETED_BY_UNKNOWN);
    expect(map.get('user:u0249')).toBe(DELETED_BY_UNKNOWN);
    consoleError.mockRestore();
  });

  it('returns an all-unknown map when every batch fails', async () => {
    const uids = new Set<string>();
    for (let i = 0; i < 250; i++) {
      uids.add(`user:u${String(i).padStart(4, '0')}`);
    }

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockDispatch
      .mockReturnValueOnce(mockSubscription(new Error('batch-1 failed')))
      .mockReturnValueOnce(mockSubscription(new Error('batch-2 failed')));

    const map = await resolveDeletedByDisplayMap(uids, new Map());

    for (let i = 0; i < 250; i++) {
      expect(map.get(`user:u${String(i).padStart(4, '0')}`)).toBe(DELETED_BY_UNKNOWN);
    }
    consoleError.mockRestore();
  });
});

describe('deletedDashboardsCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    deletedDashboardsCache.clear();
    mockInitiate.mockReturnValue('initiate-thunk');
    mockDispatch.mockReturnValue(
      mockSubscription({
        data: makeDisplayList([{ identity: { type: 'user', name: 'alice' }, displayName: 'Alice' }]),
      })
    );
  });

  afterEach(() => {
    deletedDashboardsCache.clear();
  });

  function makeItem(name: string, overrides: Record<string, unknown> = {}): TrashItem {
    return {
      resource: { group: 'dashboard.grafana.app', resource: 'dashboards', kind: 'Dashboard', name },
      fields: {
        title: `Dashboard ${name}`,
        folder: 'my-folder',
        tags: ['infra', 'prod'],
        deleted_by: 'user:alice',
        deletion_time: 1700000000000,
        deleted_rv: '1800000000000000000',
        ...overrides,
      },
    };
  }

  function page(items: TrashItem[], continueToken?: string) {
    return {
      metadata: { totalHits: items.length, totalHitsRelation: 'eq' as const, continue: continueToken },
      items,
    };
  }

  it('asks the server for the text query and the sort, and resolves the deleter', async () => {
    mockFetchTrashPage.mockResolvedValue(page([makeItem('dash-1')]));

    const result = await deletedDashboardsCache.search({ query: 'cpu', sort: 'deleted-desc' });

    expect(mockFetchTrashPage).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { text: { value: 'cpu', fields: ['title'] } },
        sort: [{ field: 'deletion_time', direction: 'desc' }],
      })
    );
    expect(result).toEqual([
      expect.objectContaining({
        name: 'dash-1',
        title: 'Dashboard dash-1',
        folder: 'my-folder',
        tags: ['infra', 'prod'],
        field: { deletionTimestamp: new Date(1700000000000).toISOString(), deletedBy: 'Alice' },
      }),
    ]);
  });

  it('recovers a deleter name that failed to resolve, without clearing the cache', async () => {
    // A deleter no other test resolves: display names outlive clear(), so a name resolved
    // earlier would never be looked up again.
    mockFetchTrashPage.mockResolvedValue(page([makeItem('dash-1', { deleted_by: 'user:carol' })]));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    mockDispatch.mockReturnValueOnce(mockSubscription({ error: { status: 500, data: 'IAM unavailable' } }));
    const first = await deletedDashboardsCache.search({});
    expect(first[0].field.deletedBy).toBe(DELETED_BY_UNKNOWN);

    mockDispatch.mockReturnValueOnce(
      mockSubscription({ data: makeDisplayList([{ identity: { type: 'user', name: 'carol' }, displayName: 'Carol' }]) })
    );
    const second = await deletedDashboardsCache.search({});
    expect(second[0].field.deletedBy).toBe('Carol');
    // The second answer came from the cached trash result, not a new fetch.
    expect(mockFetchTrashPage).toHaveBeenCalledTimes(1);

    consoleError.mockRestore();
  });

  it('asks for tags explicitly, since the server leaves them out by default', async () => {
    mockFetchTrashPage.mockResolvedValue(page([makeItem('dash-1')]));

    await deletedDashboardsCache.search({});

    expect(mockFetchTrashPage).toHaveBeenCalledWith(
      expect.objectContaining({ fields: expect.arrayContaining(['tags']) })
    );
  });

  it('sends a tag filter to the server rather than filtering in the browser', async () => {
    mockFetchTrashPage.mockResolvedValue(page([makeItem('dash-1')]));

    await deletedDashboardsCache.search({ tags: ['infra'] });

    expect(mockFetchTrashPage).toHaveBeenCalledWith(
      expect.objectContaining({ where: { filter: { field: 'tags', operator: 'In', values: ['infra'] } } })
    );
  });

  it('does not serve an unfiltered result to a tag-filtered query', async () => {
    // The tag options are built from an unfiltered fetch, so that entry is usually already
    // cached by the time a tag is picked. Sharing a key with it ignores the filter entirely.
    mockFetchTrashPage.mockResolvedValueOnce(page([makeItem('untagged'), makeItem('tagged')]));
    const all = await deletedDashboardsCache.search({});
    expect(all).toHaveLength(2);

    mockFetchTrashPage.mockResolvedValueOnce(page([makeItem('tagged')]));
    const filtered = await deletedDashboardsCache.search({ tags: ['infra'] });

    expect(filtered.map((hit) => hit.name)).toEqual(['tagged']);
    expect(mockFetchTrashPage).toHaveBeenCalledTimes(2);
  });

  it('shares one cache entry for the same tags in a different order', async () => {
    mockFetchTrashPage.mockResolvedValue(page([makeItem('dash-1')]));

    await deletedDashboardsCache.search({ tags: ['a', 'b'] });
    await deletedDashboardsCache.search({ tags: ['b', 'a'] });

    expect(mockFetchTrashPage).toHaveBeenCalledTimes(1);
  });

  it('requires every selected tag, not any of them', async () => {
    mockFetchTrashPage.mockResolvedValue(page([makeItem('dash-1')]));

    await deletedDashboardsCache.search({ tags: ['infra', 'prod'] });

    // One leaf per tag. A single In leaf listing both would match either one.
    expect(mockFetchTrashPage).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          and: [
            { filter: { field: 'tags', operator: 'In', values: ['infra'] } },
            { filter: { field: 'tags', operator: 'In', values: ['prod'] } },
          ],
        },
      })
    );
  });

  it('combines a text query and every tag into a single and', async () => {
    mockFetchTrashPage.mockResolvedValue(page([makeItem('dash-1')]));

    await deletedDashboardsCache.search({ query: 'cpu', tags: ['infra', 'prod'] });

    expect(mockFetchTrashPage).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          and: [
            { text: { value: 'cpu', fields: ['title'] } },
            { filter: { field: 'tags', operator: 'In', values: ['infra'] } },
            { filter: { field: 'tags', operator: 'In', values: ['prod'] } },
          ],
        },
      })
    );
  });

  it('skips non-string entries in the tags field', async () => {
    mockFetchTrashPage.mockResolvedValue(page([makeItem('dash-1', { tags: ['ok', 42, null] })]));

    const result = await deletedDashboardsCache.search({});

    expect(result[0].tags).toEqual(['ok']);
  });

  it('treats the empty and wildcard queries as "everything"', async () => {
    mockFetchTrashPage.mockResolvedValue(page([]));

    await deletedDashboardsCache.search({ query: '*' });

    expect(mockFetchTrashPage).toHaveBeenCalledWith(expect.not.objectContaining({ where: expect.anything() }));
  });

  it('follows the continue token until the server runs out of pages', async () => {
    mockFetchTrashPage
      .mockResolvedValueOnce(page([makeItem('dash-1')], 'next'))
      .mockResolvedValueOnce(page([makeItem('dash-2')]));

    const result = await deletedDashboardsCache.search({});

    expect(mockFetchTrashPage).toHaveBeenCalledTimes(2);
    expect(mockFetchTrashPage).toHaveBeenLastCalledWith(expect.objectContaining({ continue: 'next' }));
    expect(result.map((hit) => hit.name)).toEqual(['dash-1', 'dash-2']);
  });

  it('caches per query, so changing the query refetches but repeating it does not', async () => {
    mockFetchTrashPage.mockResolvedValue(page([makeItem('dash-1')]));

    await deletedDashboardsCache.search({ query: 'cpu' });
    await deletedDashboardsCache.search({ query: 'cpu' });
    expect(mockFetchTrashPage).toHaveBeenCalledTimes(1);

    await deletedDashboardsCache.search({ query: 'memory' });
    expect(mockFetchTrashPage).toHaveBeenCalledTimes(2);
  });

  it('hides restored dashboards until the next cache clear', async () => {
    mockFetchTrashPage.mockResolvedValue(page([makeItem('dash-1'), makeItem('dash-2')]));

    await deletedDashboardsCache.search({});
    deletedDashboardsCache.removeItems(['dash-1']);

    const afterRestore = await deletedDashboardsCache.search({});
    expect(afterRestore.map((hit) => hit.name)).toEqual(['dash-2']);

    deletedDashboardsCache.clear();
    const afterClear = await deletedDashboardsCache.search({});
    expect(afterClear.map((hit) => hit.name)).toEqual(['dash-1', 'dash-2']);
  });

  it('stops paging when the server keeps offering a token but no rows', async () => {
    // The endpoint may answer an empty page and still hand back a token, so the row count
    // cannot end the loop on its own.
    mockFetchTrashPage.mockResolvedValue(page([], 'never-clears'));

    const result = await deletedDashboardsCache.search({});

    expect(result).toEqual([]);
    expect(mockFetchTrashPage.mock.calls.length).toBeLessThanOrEqual(8);
  });

  it('shares one fetch between concurrent identical queries', async () => {
    let release: (value: unknown) => void = () => {};
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    mockFetchTrashPage.mockImplementation(async () => {
      await gate;
      return page([makeItem('dash-1')]);
    });

    const first = deletedDashboardsCache.search({});
    const second = deletedDashboardsCache.search({});
    release(undefined);

    const [a, b] = await Promise.all([first, second]);

    expect(a.map((hit) => hit.name)).toEqual(['dash-1']);
    expect(b.map((hit) => hit.name)).toEqual(['dash-1']);
    // One page fetched, not two: the second caller joined the in-flight request.
    expect(mockFetchTrashPage).toHaveBeenCalledTimes(1);
  });

  it('does not repopulate the cache when clear() lands mid-fetch', async () => {
    let release: (value: unknown) => void = () => {};
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    mockFetchTrashPage.mockImplementationOnce(async () => {
      await gate;
      return page([makeItem('stale')]);
    });

    const inFlight = deletedDashboardsCache.search({});
    deletedDashboardsCache.clear();
    release(undefined);
    await inFlight;

    // The cleared entry must not have been written back, so the next call refetches.
    mockFetchTrashPage.mockResolvedValueOnce(page([makeItem('fresh')]));
    const after = await deletedDashboardsCache.search({});

    expect(after.map((hit) => hit.name)).toEqual(['fresh']);
    expect(mockFetchTrashPage).toHaveBeenCalledTimes(2);
  });

  const fullPage = () => Array.from({ length: DELETED_DASHBOARDS_LIMIT }, (_, i) => makeItem(`dash-${i}`));

  it('reports truncation only when the server still had rows to give', async () => {
    // The ceiling reached with a token left over: the list on screen is not everything.
    mockFetchTrashPage.mockResolvedValueOnce(page(fullPage(), 'more-to-come'));
    await deletedDashboardsCache.search({ query: 'truncated' });
    expect(deletedDashboardsCache.isTrashTruncated()).toBe(true);

    // Exhausted the result set: nothing hidden.
    mockFetchTrashPage.mockResolvedValueOnce(page([makeItem('dash-2')]));
    await deletedDashboardsCache.search({ query: 'complete' });
    expect(deletedDashboardsCache.isTrashTruncated()).toBe(false);
  });

  it('does not call short pages truncated just because a token came back', async () => {
    // Stopping at the page cap also leaves rows behind, but the banner names 1000, and far
    // fewer than that came back.
    mockFetchTrashPage.mockResolvedValue(page([makeItem('dash-1')], 'never-clears'));

    await deletedDashboardsCache.search({ query: 'short-pages' });

    expect(deletedDashboardsCache.isTrashTruncated()).toBe(false);
  });

  it('clears truncation when the fetch fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    mockFetchTrashPage.mockResolvedValueOnce(page(fullPage(), 'more-to-come'));
    await deletedDashboardsCache.search({ query: 'truncated' });
    expect(deletedDashboardsCache.isTrashTruncated()).toBe(true);

    mockFetchTrashPage.mockRejectedValueOnce({ status: 503, data: {} });
    await deletedDashboardsCache.search({ query: 'then-fails' });

    // No list came back, so nothing was left out of one.
    expect(deletedDashboardsCache.isTrashTruncated()).toBe(false);

    consoleError.mockRestore();
  });

  it('building the tag options does not disturb what the page reports', async () => {
    // The page is showing a truncated list.
    mockFetchTrashPage.mockResolvedValueOnce(page(fullPage(), 'more-to-come'));
    await deletedDashboardsCache.search({ query: 'truncated' });
    expect(deletedDashboardsCache.isTrashTruncated()).toBe(true);

    // The tag dropdown asks an unfiltered question, which is not what is on screen.
    mockFetchTrashPage.mockResolvedValueOnce(page([makeItem('dash-1')]));
    await deletedDashboardsCache.searchAllForOptions();

    expect(deletedDashboardsCache.isTrashTruncated()).toBe(true);
  });

  it('reports trash unavailable on 503, and retries rather than caching the failure', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchTrashPage.mockRejectedValueOnce({ status: 503, data: { message: 'rebuilding' } });

    await expect(deletedDashboardsCache.search({})).resolves.toEqual([]);
    expect(deletedDashboardsCache.isTrashUnavailable()).toBe(true);

    // Same query again: the index may have finished rebuilding, so it must ask again.
    mockFetchTrashPage.mockResolvedValueOnce(page([makeItem('dash-1')]));
    const retry = await deletedDashboardsCache.search({});

    expect(retry.map((hit) => hit.name)).toEqual(['dash-1']);
    expect(deletedDashboardsCache.isTrashUnavailable()).toBe(false);
    expect(mockFetchTrashPage).toHaveBeenCalledTimes(2);

    consoleError.mockRestore();
  });

  it('ignores a superseded fetch that fails after a newer one has taken over', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    // First fetch is held open, and will fail with 503 once released.
    let release: (value: unknown) => void = () => {};
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    mockFetchTrashPage.mockImplementationOnce(async () => {
      await gate;
      throw { status: 503, data: {} };
    });

    const superseded = deletedDashboardsCache.search({});

    // clear() drops it, and a newer fetch for the same query succeeds.
    deletedDashboardsCache.clear();
    mockFetchTrashPage.mockResolvedValueOnce(page([makeItem('fresh')]));
    const current = await deletedDashboardsCache.search({});
    expect(current.map((hit) => hit.name)).toEqual(['fresh']);

    // The old 503 lands last. It must not raise a warning over results that superseded it.
    release(undefined);
    await superseded;

    expect(deletedDashboardsCache.isTrashUnavailable()).toBe(false);

    consoleError.mockRestore();
  });

  it('does not report unavailable for failures other than 503', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchTrashPage.mockRejectedValue({ status: 404, data: {} });

    await expect(deletedDashboardsCache.search({})).resolves.toEqual([]);
    expect(deletedDashboardsCache.isTrashUnavailable()).toBe(false);

    consoleError.mockRestore();
  });

  it('returns an empty list when the endpoint fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchTrashPage.mockRejectedValue(new Error('trash is off'));

    await expect(deletedDashboardsCache.search({})).resolves.toEqual([]);

    consoleError.mockRestore();
  });
});
