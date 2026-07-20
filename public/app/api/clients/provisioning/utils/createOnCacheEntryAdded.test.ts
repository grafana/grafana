import { produce } from 'immer';
import { Subject } from 'rxjs';

import { ScopedResourceClient } from 'app/features/apiserver/client';
import { type GeneratedResourceList, type Resource, type ResourceEvent } from 'app/features/apiserver/types';

import { createOnCacheEntryAdded } from './createOnCacheEntryAdded';

jest.mock('app/features/apiserver/client', () => ({
  ScopedResourceClient: jest.fn(),
}));

interface TestSpec {
  title: string;
}

interface TestStatus {
  state: string;
}

type List = GeneratedResourceList<TestSpec, TestStatus>;

function makeObject(name: string, resourceVersion?: string, state = 'working'): Resource<TestSpec, TestStatus> {
  return {
    apiVersion: 'provisioning.grafana.app/v0alpha1',
    kind: 'Job',
    metadata: { name, resourceVersion, creationTimestamp: '2024-01-01T00:00:00Z' },
    spec: { title: name },
    status: { state },
  } as unknown as Resource<TestSpec, TestStatus>;
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function setup(initial: List) {
  const events = new Subject<ResourceEvent<TestSpec, TestStatus>>();
  jest
    .mocked(ScopedResourceClient)
    .mockImplementation(() => ({ watch: () => events.asObservable() }) as unknown as ScopedResourceClient);

  let state = initial;
  let resolveCacheEntryRemoved = () => {};
  const done = createOnCacheEntryAdded<TestSpec, TestStatus>('jobs')(
    { watch: true },
    {
      updateCachedData: (fn: (draft: List) => void) => {
        state = produce(state, fn);
      },
      cacheDataLoaded: Promise.resolve({ data: initial }),
      cacheEntryRemoved: new Promise<void>((resolve) => {
        resolveCacheEntryRemoved = resolve;
      }),
      dispatch: jest.fn(),
    }
  );

  return {
    events,
    getState: () => state,
    resolveCacheEntryRemoved: () => resolveCacheEntryRemoved(),
    done,
  };
}

describe('createOnCacheEntryAdded', () => {
  it('appends an ADDED event for a name not in the cache', async () => {
    const { events, getState } = setup({ metadata: { resourceVersion: '10' }, items: [makeObject('a', '5')] });
    await flush();

    events.next({ type: 'ADDED', object: makeObject('b', '11') });

    expect(getState().items).toHaveLength(2);
    expect(getState().items?.[1].metadata?.name).toBe('b');
  });

  it('applies a MODIFIED event with a newer resourceVersion', async () => {
    const { events, getState } = setup({ metadata: { resourceVersion: '10' }, items: [makeObject('a', '5')] });
    await flush();

    events.next({ type: 'MODIFIED', object: makeObject('a', '11', 'success') });

    expect(getState().items?.[0].metadata?.resourceVersion).toBe('11');
    expect(getState().items?.[0].status?.state).toBe('success');
  });

  it('compares resourceVersions numerically, not lexicographically', async () => {
    const { events, getState } = setup({ metadata: { resourceVersion: '10' }, items: [makeObject('a', '9')] });
    await flush();

    // '10' < '9' as strings, but 10 > 9 numerically — the event must apply
    events.next({ type: 'MODIFIED', object: makeObject('a', '10', 'success') });

    expect(getState().items?.[0].metadata?.resourceVersion).toBe('10');
  });

  it('skips a stale MODIFIED event with an older resourceVersion, leaving state untouched', async () => {
    const { events, getState } = setup({
      metadata: { resourceVersion: '10' },
      items: [makeObject('a', '8', 'success')],
    });
    await flush();
    const before = getState();

    events.next({ type: 'MODIFIED', object: makeObject('a', '5', 'working') });

    // same reference: no store update, no re-render for subscribers
    expect(getState()).toBe(before);
    expect(getState().items?.[0].status?.state).toBe('success');
  });

  it('skips a duplicate MODIFIED event with an equal resourceVersion, leaving state untouched', async () => {
    const { events, getState } = setup({ metadata: { resourceVersion: '10' }, items: [makeObject('a', '8')] });
    await flush();
    const before = getState();

    events.next({ type: 'MODIFIED', object: makeObject('a', '8') });

    expect(getState()).toBe(before);
  });

  it('skips a duplicate ADDED event for an item already in the cache with the same resourceVersion', async () => {
    const { events, getState } = setup({ metadata: { resourceVersion: '10' }, items: [makeObject('a', '8')] });
    await flush();
    const before = getState();

    events.next({ type: 'ADDED', object: makeObject('a', '8') });

    expect(getState()).toBe(before);
    expect(getState().items).toHaveLength(1);
  });

  it('applies a MODIFIED event when the event has no resourceVersion (fail open)', async () => {
    const { events, getState } = setup({ metadata: { resourceVersion: '10' }, items: [makeObject('a', '8')] });
    await flush();

    events.next({ type: 'MODIFIED', object: makeObject('a', undefined, 'success') });

    expect(getState().items?.[0].status?.state).toBe('success');
  });

  it('applies a MODIFIED event when the cached item has no resourceVersion (fail open)', async () => {
    const { events, getState } = setup({ metadata: { resourceVersion: '10' }, items: [makeObject('a', undefined)] });
    await flush();

    events.next({ type: 'MODIFIED', object: makeObject('a', '2', 'success') });

    expect(getState().items?.[0].status?.state).toBe('success');
  });

  it('removes an item on DELETED and ignores a duplicate DELETED', async () => {
    const { events, getState } = setup({
      metadata: { resourceVersion: '10' },
      items: [makeObject('a', '5'), makeObject('b', '7')],
    });
    await flush();

    events.next({ type: 'DELETED', object: makeObject('a', '11') });

    expect(getState().items).toHaveLength(1);
    expect(getState().items?.[0].metadata?.name).toBe('b');

    const before = getState();
    events.next({ type: 'DELETED', object: makeObject('a', '11') });

    expect(getState()).toBe(before);
  });

  it('skips a stale DELETED event older than the cached item', async () => {
    const { events, getState } = setup({ metadata: { resourceVersion: '10' }, items: [makeObject('a', '9')] });
    await flush();
    const before = getState();

    // the object was re-created after this delete was emitted
    events.next({ type: 'DELETED', object: makeObject('a', '4') });

    expect(getState()).toBe(before);
    expect(getState().items).toHaveLength(1);
  });

  it('unsubscribes from the watch when the cache entry is removed', async () => {
    const { events, resolveCacheEntryRemoved, done } = setup({ metadata: { resourceVersion: '10' }, items: [] });
    await flush();
    expect(events.observed).toBe(true);

    resolveCacheEntryRemoved();
    await done;

    expect(events.observed).toBe(false);
  });
});
