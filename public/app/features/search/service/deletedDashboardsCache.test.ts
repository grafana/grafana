import { iamAPIv0alpha1, type Display, type DisplayList } from 'app/api/clients/iam/v0alpha1';
import { type DashboardDataDTO } from 'app/types/dashboard';
import { dispatch } from 'app/types/store';

import { AnnoKeyUpdatedBy, type Resource, type ResourceList } from '../../apiserver/types';

import { resolveDeletedByDisplayMap } from './deletedDashboardsCache';

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

function makeItem(name: string, deletedByUid?: string): Resource<DashboardDataDTO> {
  const annotations: Record<string, string> = {};
  if (deletedByUid !== undefined) {
    annotations[AnnoKeyUpdatedBy] = deletedByUid;
  }
  return {
    apiVersion: 'dashboard.grafana.app/v1beta1',
    kind: 'Dashboard',
    metadata: {
      name,
      resourceVersion: '1',
      creationTimestamp: '2024-01-01T00:00:00Z',
      deletionTimestamp: '2024-06-01T00:00:00Z',
      annotations,
    },
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    spec: { title: name, uid: name } as DashboardDataDTO,
  };
}

function makeResourceList(items: Array<Resource<DashboardDataDTO>>): ResourceList<DashboardDataDTO> {
  return {
    apiVersion: 'dashboard.grafana.app/v1beta1',
    kind: 'DashboardList',
    metadata: { resourceVersion: '0' },
    items,
  };
}

function makeDisplayList(display: Display[]): DisplayList {
  return {
    display,
    keys: display.map((d) => `${d.identity.type}:${d.identity.name}`),
    metadata: {},
  };
}

type MockResult = { data?: DisplayList; error?: unknown };

// The dispatched RTK Query thunk returns a `QueryActionCreatorResult` — a thenable that also
// exposes `.unsubscribe()`. The production code awaits the thenable and calls `.unsubscribe()`
// in a `finally` block, so tests must return a shape that matches both.
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

  it('returns undefined and does not dispatch when the list is empty', async () => {
    const map = await resolveDeletedByDisplayMap(makeResourceList([]));

    expect(map).toBeUndefined();
    expect(mockInitiate).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('returns undefined and does not dispatch when no item has an updatedBy annotation', async () => {
    const map = await resolveDeletedByDisplayMap(makeResourceList([makeItem('a'), makeItem('b')]));

    expect(map).toBeUndefined();
    expect(mockInitiate).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('dispatches getDisplayMapping with deduplicated UIDs and subscribe:false', async () => {
    mockDispatch.mockReturnValue(mockSubscription({ data: makeDisplayList([]) }));

    await resolveDeletedByDisplayMap(
      makeResourceList([
        makeItem('a', 'user:alice'),
        makeItem('b', 'user:alice'), // duplicate UID
        makeItem('c', 'user:bob'),
        makeItem('d'), // no annotation
      ])
    );

    expect(mockInitiate).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith('initiate-thunk');
    const [keyArg, optionsArg] = mockInitiate.mock.calls[0] as [{ key: string[] }, { subscribe: boolean }];
    // Keys are sorted before dispatch so equivalent UID sets produce stable RTKQ cache keys.
    expect(keyArg.key).toEqual(['user:alice', 'user:bob']);
    expect(optionsArg).toEqual({ subscribe: false });
  });

  it('unsubscribes from the RTK Query cache entry after resolving', async () => {
    const unsubscribe = jest.fn();
    mockDispatch.mockReturnValue(
      mockSubscription(
        { data: makeDisplayList([{ identity: { type: 'user', name: 'alice' }, displayName: 'Alice' }]) },
        unsubscribe
      )
    );

    await resolveDeletedByDisplayMap(makeResourceList([makeItem('a', 'user:alice')]));

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes from the RTK Query cache entry even when the thunk rejects', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const unsubscribe = jest.fn();
    mockDispatch.mockReturnValue(mockSubscription(new Error('boom'), unsubscribe));

    await resolveDeletedByDisplayMap(makeResourceList([makeItem('a', 'user:alice')]));

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it('logs and unsubscribes when RTK Query resolves with an error result', async () => {
    // RTK Query query thunks are `SafePromise`s — on request failure they resolve with
    // an `{ error, data: undefined }` shape rather than rejecting. Production must handle
    // that path explicitly; a silent `return undefined` would swallow server errors.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const unsubscribe = jest.fn();
    mockDispatch.mockReturnValue(mockSubscription({ error: { status: 500, data: 'upstream failure' } }, unsubscribe));

    const map = await resolveDeletedByDisplayMap(makeResourceList([makeItem('a', 'user:alice')]));

    expect(map).toBeUndefined();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith('Failed to resolve deleted dashboard user displays:', {
      status: 500,
      data: 'upstream failure',
    });
    consoleError.mockRestore();
  });

  it('builds a map keyed by identity `type:name`', async () => {
    mockDispatch.mockReturnValue(
      mockSubscription({ data: makeDisplayList([{ identity: { type: 'user', name: 'alice' }, displayName: 'Alice' }]) })
    );

    const map = await resolveDeletedByDisplayMap(makeResourceList([makeItem('a', 'user:alice')]));

    expect(map?.get('user:alice')).toBe('Alice');
    expect(map?.size).toBe(1);
  });

  it('additionally keys the map by String(internalId) when provided', async () => {
    mockDispatch.mockReturnValue(
      mockSubscription({
        data: makeDisplayList([{ identity: { type: 'user', name: 'alice' }, displayName: 'Alice', internalId: 42 }]),
      })
    );

    const map = await resolveDeletedByDisplayMap(makeResourceList([makeItem('a', 'user:alice')]));

    expect(map?.get('user:alice')).toBe('Alice');
    expect(map?.get('42')).toBe('Alice');
    expect(map?.get('user:42')).toBe('Alice');
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

    const map = await resolveDeletedByDisplayMap(makeResourceList([makeItem('a', 'user:1')]));

    expect(map?.get('user:1')).toBe('Alice');
    expect(map?.get('user:u000000001')).toBe('Alice');
    expect(map?.get('1')).toBe('Alice');
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

    const map = await resolveDeletedByDisplayMap(
      makeResourceList([makeItem('a', 'user:tanaka'), makeItem('b', 'user:mohamed')])
    );

    expect(map?.get('user:tanaka')).toBe('田中太郎');
    expect(map?.get('user:mohamed')).toBe('محمد العربي');
  });

  it('omits entries for UIDs the server could not resolve', async () => {
    mockDispatch.mockReturnValue(
      mockSubscription({ data: makeDisplayList([{ identity: { type: 'user', name: 'alice' }, displayName: 'Alice' }]) })
    );

    const map = await resolveDeletedByDisplayMap(
      makeResourceList([makeItem('a', 'user:alice'), makeItem('b', 'user:missing')])
    );

    expect(map?.get('user:alice')).toBe('Alice');
    expect(map?.has('user:missing')).toBe(false);
  });

  it('returns undefined when the dispatch resolves with no data', async () => {
    mockDispatch.mockReturnValue(mockSubscription({ data: undefined }));

    const map = await resolveDeletedByDisplayMap(makeResourceList([makeItem('a', 'user:alice')]));

    expect(map).toBeUndefined();
  });

  it('returns undefined and swallows errors when the dispatch rejects', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockDispatch.mockReturnValue(mockSubscription(new Error('boom')));

    const map = await resolveDeletedByDisplayMap(makeResourceList([makeItem('a', 'user:alice')]));

    expect(map).toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
