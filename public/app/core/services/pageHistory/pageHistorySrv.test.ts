import { createMemoryHistory } from 'history';
import { http, HttpResponse } from 'msw';

import { store } from '@grafana/data';
import { config, HistoryWrapper, locationService, setBackendSrv, setLocationService } from '@grafana/runtime';
import { UserStorage } from '@grafana/runtime/internal';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { markAsUrlRewrite } from 'app/core/navigation/urlRewrite';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';

import { PAGE_HISTORY_MAX_BYTES, PageHistorySrv } from './pageHistorySrv';
import { PAGE_HISTORY_MAX, type PageHistoryEntry } from './types';

setBackendSrv(backendSrv);
setupMockServer();

const LOCAL_KEY = 'grafana-page-history:0:org-1:local';
const REMOTE_KEY = 'grafana-page-history:0:org-1';
const USER_STORAGE_URL = '/apis/userstorage.grafana.app/v0alpha1/namespaces/default/user-storage';

const T0 = 1_700_000_000_000;
const T1 = T0 + 60_000;
const T2 = T0 + 120_000;
const T3 = T0 + 180_000;

let srv: PageHistorySrv | undefined;
const originalUser = { ...config.bootData.user };
const originalOrgId = contextSrv.user.orgId;

function startAt(path: string) {
  setLocationService(new HistoryWrapper(createMemoryHistory({ initialEntries: [path] })));
  srv = new PageHistorySrv();
  srv.start();
  return srv;
}

function entry(overrides: Partial<PageHistoryEntry> & Pick<PageHistoryEntry, 'key' | 'kind' | 'href'>) {
  return { lastVisited: T0, visits: 1, ...overrides };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** Lets fetch polyfill timers and MSW promise chains run under fake timers. */
async function settle(rounds = 20) {
  for (let i = 0; i < rounds; i++) {
    await jest.advanceTimersByTimeAsync(0);
  }
}

beforeEach(() => {
  jest.useFakeTimers({ now: T0 });
  window.localStorage.clear();
  // Anonymous user in org 1: UserStorage keys on `uid || id`, the service keys on `contextSrv.user.orgId`.
  config.bootData.user.uid = '';
  config.bootData.user.id = 0;
  config.bootData.user.isSignedIn = false;
  contextSrv.user.orgId = 1;
});

afterEach(() => {
  srv?.stop();
  srv = undefined;
  jest.useRealTimers();
  jest.restoreAllMocks();
  Object.assign(config.bootData.user, originalUser);
  contextSrv.user.orgId = originalOrgId;
  Reflect.deleteProperty(document, 'visibilityState');
});

describe('PageHistorySrv', () => {
  it('records the landing page as one visit', async () => {
    const srv = startAt('/d/abc?from=now-1h&to=now');

    expect(await srv.getEntries()).toEqual([
      { key: 'dashboard:abc', kind: 'dashboard', href: '/d/abc?from=now-1h&to=now', lastVisited: T0, visits: 1 },
    ]);
  });

  it('refreshes the href on query churn without counting a visit', async () => {
    const srv = startAt('/d/abc?from=now-1h&to=now');
    await srv.getEntries();

    jest.setSystemTime(T1);
    locationService.partial({ from: 'now-6h' });

    expect(await srv.getEntries()).toEqual([
      { key: 'dashboard:abc', kind: 'dashboard', href: '/d/abc?from=now-6h&to=now', lastVisited: T1, visits: 1 },
    ]);
  });

  it('treats a flagged REPLACE as an in-place rewrite', async () => {
    const srv = startAt('/d/abc?from=now-6h&to=now');
    await srv.getEntries();

    locationService.replace(markAsUrlRewrite({ pathname: '/d/abc/slug', search: '?from=now-6h&to=now' }));

    expect(await srv.getEntries()).toEqual([
      expect.objectContaining({ key: 'dashboard:abc', href: '/d/abc/slug?from=now-6h&to=now', visits: 1 }),
    ]);
  });

  it('counts an unflagged REPLACE to another page as a navigation', async () => {
    const srv = startAt('/d/abc');
    await srv.getEntries();

    locationService.replace('/d/xyz');

    expect(await srv.getEntries()).toEqual([
      expect.objectContaining({ key: 'dashboard:xyz', visits: 1 }),
      expect.objectContaining({ key: 'dashboard:abc', visits: 1 }),
    ]);
  });

  it('moves revisited pages to the top, including on POP', async () => {
    const srv = startAt('/d/abc');
    await srv.getEntries();

    locationService.push('/explore?schemaVersion=1&panes=%7B%7D');
    locationService.push('/d/abc');

    expect(await srv.getEntries()).toEqual([
      expect.objectContaining({ key: 'dashboard:abc', visits: 2 }),
      expect.objectContaining({ key: 'explore', visits: 1 }),
    ]);

    locationService.getHistory().goBack();

    expect(await srv.getEntries()).toEqual([
      expect.objectContaining({ key: 'explore', href: '/explore?schemaVersion=1&panes=%7B%7D', visits: 2 }),
      expect.objectContaining({ key: 'dashboard:abc', visits: 2 }),
    ]);
  });

  it('keeps the latest event first within the same millisecond', async () => {
    const srv = startAt('/');
    await srv.getEntries();

    locationService.push('/alerting/list');
    locationService.push('/alerting/silences');

    expect((await srv.getEntries()).map((e) => e.key)).toEqual(['/alerting/silences', '/alerting/list']);
  });

  it('classifies pages and ignores unlisted ones', async () => {
    const srv = startAt('/');
    await srv.getEntries();

    locationService.push('/a/grafana-ml-app/investigations/123?x=1');
    locationService.push('/a/grafana-ml-app/investigations');
    locationService.push('/alerting/list?search=x');
    locationService.push('/dashboards');

    expect(await srv.getEntries()).toEqual([
      expect.objectContaining({ kind: 'alerting', key: '/alerting/list', href: '/alerting/list?search=x' }),
      expect.objectContaining({ kind: 'app', key: '/a/grafana-ml-app/investigations' }),
      expect.objectContaining({
        kind: 'investigation',
        key: 'investigation:123',
        href: '/a/grafana-ml-app/investigations/123?x=1',
      }),
    ]);
  });

  it('ignores the home dashboard rewrite', async () => {
    const srv = startAt('/');
    await srv.getEntries();

    locationService.replace(markAsUrlRewrite('/d/home-uid/home'));

    expect(await srv.getEntries()).toEqual([]);
  });

  it('caps the list by count and by serialized size, evicting the oldest first', async () => {
    const srv = startAt('/');
    await srv.getEntries();

    for (let i = 0; i <= PAGE_HISTORY_MAX; i++) {
      locationService.push(`/d/${i}`);
    }

    const byCount = await srv.getEntries();
    expect(byCount).toHaveLength(PAGE_HISTORY_MAX);
    expect(byCount[0].key).toBe(`dashboard:${PAGE_HISTORY_MAX}`);
    expect(byCount.some((e) => e.key === 'dashboard:0')).toBe(false);

    const bigQuery = `?q=${'x'.repeat(3000)}`;
    for (let i = 0; i < 70; i++) {
      locationService.push(`/d/big-${i}${bigQuery}`);
    }

    const byBytes = await srv.getEntries();
    expect(JSON.stringify(byBytes).length).toBeLessThanOrEqual(PAGE_HISTORY_MAX_BYTES);
    expect(byBytes.length).toBeLessThan(70);
    // Every surviving row is one of the newest pushes, contiguous from the top.
    expect(byBytes.map((e) => e.key)).toEqual(
      Array.from({ length: byBytes.length }, (_, i) => `dashboard:big-${69 - i}`)
    );
  });

  it('mirrors to localStorage once per debounce window', async () => {
    const setSpy = jest.spyOn(store, 'set');
    const srv = startAt('/d/abc');
    await srv.getEntries();

    locationService.push('/d/def');
    locationService.push('/d/ghi');
    expect(window.localStorage.getItem(LOCAL_KEY)).toBeNull();

    jest.advanceTimersByTime(250);

    expect(setSpy.mock.calls.filter(([key]) => key === LOCAL_KEY)).toHaveLength(1);
    expect(JSON.parse(window.localStorage.getItem(LOCAL_KEY)!)).toEqual(await srv.getEntries());
  });

  it('writes the remote copy through UserStorage for anonymous users', async () => {
    const srv = startAt('/d/abc');
    await srv.getEntries();

    jest.advanceTimersByTime(999);
    expect(window.localStorage.getItem(REMOTE_KEY)).toBeNull();

    await jest.advanceTimersByTimeAsync(1);

    expect(window.localStorage.getItem(REMOTE_KEY)).toBe(JSON.stringify(await srv.getEntries()));
  });

  it('creates then patches the user storage resource for signed-in users', async () => {
    config.bootData.user.isSignedIn = true;
    config.bootData.user.uid = 'abc';
    const posts: unknown[] = [];
    const patches: Array<{ name: string; contentType: string | null; body: unknown }> = [];
    server.use(
      http.get(`${USER_STORAGE_URL}/:name`, () => HttpResponse.json({}, { status: 404 })),
      http.post(`${USER_STORAGE_URL}/`, async ({ request }) => {
        posts.push(await request.json());
        return HttpResponse.json({}, { status: 201 });
      }),
      http.patch(`${USER_STORAGE_URL}/:name`, async ({ request, params }) => {
        patches.push({
          name: String(params.name),
          contentType: request.headers.get('content-type'),
          body: await request.json(),
        });
        return HttpResponse.json({});
      })
    );

    const srv = startAt('/d/abc');
    await settle();
    const first = await srv.getEntries();
    expect(first).toEqual([expect.objectContaining({ key: 'dashboard:abc' })]);

    await jest.advanceTimersByTimeAsync(1000);
    await settle();

    expect(posts).toEqual([
      {
        metadata: { name: 'grafana-page-history:abc', labels: { user: 'abc', service: 'grafana-page-history' } },
        spec: { data: { 'org-1': JSON.stringify(first) } },
      },
    ]);
    expect(patches).toEqual([]);

    locationService.push('/d/def');
    await jest.advanceTimersByTimeAsync(1000);
    await settle();

    expect(posts).toHaveLength(1);
    expect(patches).toEqual([
      {
        name: 'grafana-page-history:abc',
        contentType: 'application/merge-patch+json',
        body: { spec: { data: { 'org-1': JSON.stringify(await srv.getEntries()) } } },
      },
    ]);
  });

  it('flushes the local mirror when the tab is hidden', async () => {
    const srv = startAt('/d/abc');
    await srv.getEntries();

    locationService.push('/d/def');
    expect(window.localStorage.getItem(LOCAL_KEY)).toBeNull();

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(JSON.parse(window.localStorage.getItem(LOCAL_KEY)!)).toEqual(await srv.getEntries());
  });

  it('merges the local and remote copies on load, dropping invalid and misclassified rows', async () => {
    window.localStorage.setItem(
      LOCAL_KEY,
      JSON.stringify([
        entry({ key: 'dashboard:old', kind: 'dashboard', href: '/d/old', lastVisited: 100 }),
        entry({ key: 'explore', kind: 'explore', href: '/explore?a=1', lastVisited: 300, visits: 2 }),
      ])
    );
    window.localStorage.setItem(
      REMOTE_KEY,
      JSON.stringify([
        entry({ key: 'explore', kind: 'explore', href: '/explore?a=2', lastVisited: 200, visits: 5 }),
        { key: 'dashboard:x', kind: 'dashboard', href: '/d/x', lastVisited: 50 },
        entry({ key: 'dashboard:bad', kind: 'dashboard', href: '/alerting/list', lastVisited: 400 }),
      ])
    );

    const srv = startAt('/alerting/list');

    expect(await srv.getEntries()).toEqual([
      { key: '/alerting/list', kind: 'alerting', href: '/alerting/list', lastVisited: T0, visits: 1 },
      { key: 'explore', kind: 'explore', href: '/explore?a=1', lastVisited: 300, visits: 2 },
      { key: 'dashboard:old', kind: 'dashboard', href: '/d/old', lastVisited: 100, visits: 1 },
    ]);
  });

  it('replays events recorded before the load finished with their original times', async () => {
    const deferred = createDeferred<string | null>();
    jest.spyOn(UserStorage.prototype, 'getItem').mockReturnValue(deferred.promise);

    const srv = startAt('/');
    jest.setSystemTime(T1);
    locationService.push('/d/a');
    jest.setSystemTime(T2);
    locationService.push('/d/b');
    jest.setSystemTime(T3);
    deferred.resolve(null);

    expect(await srv.getEntries()).toEqual([
      expect.objectContaining({ key: 'dashboard:b', lastVisited: T2 }),
      expect.objectContaining({ key: 'dashboard:a', lastVisited: T1 }),
    ]);
  });

  it('writes nothing after stop() and returns nothing when never started', async () => {
    const setSpy = jest.spyOn(store, 'set');
    const deferred = createDeferred<string | null>();
    jest.spyOn(UserStorage.prototype, 'getItem').mockReturnValue(deferred.promise);

    const srv = startAt('/d/abc');
    srv.stop();

    locationService.push('/d/def');
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    deferred.resolve(null);
    await srv.getEntries();
    jest.advanceTimersByTime(2000);

    expect(setSpy).not.toHaveBeenCalled();
    expect(await new PageHistorySrv().getEntries()).toEqual([]);
  });
});
