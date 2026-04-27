import { iamAPIv0alpha1, type Display, type DisplayList } from 'app/api/clients/iam/v0alpha1';
import { dispatch } from 'app/types/store';

import { resolveDeletedByDisplayMap } from './deletedDashboardsCache';
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

// The dispatched RTK Query thunk returns a `QueryActionCreatorResult` — a thenable that also
// exposes `.unsubscribe()`. Production awaits the thenables via `Promise.allSettled` and calls
// `.unsubscribe()` in a `finally` block, so tests must return a shape that matches both.
function mockSubscription(
  result: MockResult | Error,
  unsubscribe: jest.Mock = jest.fn()
): PromiseLike<MockResult> & { unsubscribe: jest.Mock } {
  return {
    then(onFulfilled, onRejected) {
      if (result instanceof Error) {
        return Promise.reject(result).then(onFulfilled, onRejected);
      }
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
    unsubscribe,
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

  it('unsubscribes from the RTK Query cache entry after resolving', async () => {
    const unsubscribe = jest.fn();
    mockDispatch.mockReturnValue(
      mockSubscription(
        { data: makeDisplayList([{ identity: { type: 'user', name: 'alice' }, displayName: 'Alice' }]) },
        unsubscribe
      )
    );

    await resolveDeletedByDisplayMap(new Set(['user:alice']), new Map());

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes from the RTK Query cache entry even when the thunk rejects', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const unsubscribe = jest.fn();
    mockDispatch.mockReturnValue(mockSubscription(new Error('boom'), unsubscribe));

    await resolveDeletedByDisplayMap(new Set(['user:alice']), new Map());

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it('logs and marks UIDs as unknown when RTK Query resolves with an error result', async () => {
    // RTK Query query thunks are `SafePromise`s — on request failure they resolve with
    // an `{ error, data: undefined }` shape rather than rejecting. Production routes the error
    // through `getMessageFromError`, which falls back to `JSON.stringify` for plain objects.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const unsubscribe = jest.fn();
    mockDispatch.mockReturnValue(mockSubscription({ error: { status: 500, data: 'upstream failure' } }, unsubscribe));

    const map = await resolveDeletedByDisplayMap(new Set(['user:alice']), new Map());

    expect(map.get('user:alice')).toBe(DELETED_BY_UNKNOWN);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
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
    const unsubscribeA = jest.fn();
    const unsubscribeB = jest.fn();
    mockDispatch
      .mockReturnValueOnce(
        mockSubscription(
          {
            data: makeDisplayList([{ identity: { type: 'user', name: 'u0000' }, displayName: 'Alice' }]),
          },
          unsubscribeA
        )
      )
      .mockReturnValueOnce(mockSubscription(new Error('batch-2 failed'), unsubscribeB));

    const map = await resolveDeletedByDisplayMap(uids, new Map());

    // First batch's resolved UID: real display name.
    expect(map.get('user:u0000')).toBe('Alice');
    // First batch's unresolved UIDs: DELETED_BY_REMOVED (successful batch, no IAM entry).
    expect(map.get('user:u0001')).toBe(DELETED_BY_REMOVED);
    // Second batch's UIDs: DELETED_BY_UNKNOWN (batch failed).
    expect(map.get('user:u0200')).toBe(DELETED_BY_UNKNOWN);
    expect(map.get('user:u0249')).toBe(DELETED_BY_UNKNOWN);
    // Both batches' subscriptions unsubscribed.
    expect(unsubscribeA).toHaveBeenCalledTimes(1);
    expect(unsubscribeB).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it('returns an all-unknown map when every batch fails', async () => {
    const uids = new Set<string>();
    for (let i = 0; i < 250; i++) {
      uids.add(`user:u${String(i).padStart(4, '0')}`);
    }

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const unsubscribeA = jest.fn();
    const unsubscribeB = jest.fn();
    mockDispatch
      .mockReturnValueOnce(mockSubscription(new Error('batch-1 failed'), unsubscribeA))
      .mockReturnValueOnce(mockSubscription(new Error('batch-2 failed'), unsubscribeB));

    const map = await resolveDeletedByDisplayMap(uids, new Map());

    for (let i = 0; i < 250; i++) {
      expect(map.get(`user:u${String(i).padStart(4, '0')}`)).toBe(DELETED_BY_UNKNOWN);
    }
    expect(unsubscribeA).toHaveBeenCalledTimes(1);
    expect(unsubscribeB).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});
