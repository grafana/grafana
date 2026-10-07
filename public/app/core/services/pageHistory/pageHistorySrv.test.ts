import { createMemoryHistory } from 'history';
import { http, HttpResponse } from 'msw';

import { store } from '@grafana/data';
import { config, HistoryWrapper, locationService, setBackendSrv, setLocationService } from '@grafana/runtime';
import { UserStorage } from '@grafana/runtime/internal';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { AppChromeService } from 'app/core/components/AppChrome/AppChromeService';
import { markAsUrlRewrite } from 'app/core/navigation/urlRewrite';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';

import { PAGE_HISTORY_MAX, PAGE_HISTORY_MAX_BYTES, PageHistorySrv } from './pageHistorySrv';
import { type PageHistoryEntry } from './types';

setBackendSrv(backendSrv);
setupMockServer();

/** UserStorage's localStorage fallback key for the anonymous user in org 1. */
const STORAGE_KEY = 'grafana-page-history:0:org-1';
const USER_STORAGE_URL = '/apis/userstorage.grafana.app/v0alpha1/namespaces/default/user-storage';

const T0 = 1_700_000_000_000;
const T1 = T0 + 60_000;
const T2 = T0 + 120_000;
const T3 = T0 + 180_000;

let srv: PageHistorySrv | undefined;
const originalUser = { ...config.bootData.user };
const originalOrgId = contextSrv.user.orgId;

let chrome: AppChromeService;

function startAt(path: string) {
  setLocationService(new HistoryWrapper(createMemoryHistory({ initialEntries: [path] })));
  chrome = new AppChromeService();
  srv = new PageHistorySrv();
  srv.start(chrome);
  return srv;
}

/** What a rendered page does: sets its section, optionally a page-specific nav. */
function renderPage(section: string, main: string, pageNav?: string) {
  chrome.update({
    sectionNav: { node: { text: section }, main: { text: main } },
    pageNav: pageNav ? { text: pageNav } : undefined,
  });
}

function stored(entries: PageHistoryEntry[]) {
  return entries.map(({ href, lastVisited }) => ({ href, lastVisited }));
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
  it('records the landing page', async () => {
    const srv = startAt('/d/abc?from=now-1h&to=now');

    expect(await srv.getEntries()).toEqual([
      { kind: 'dashboard', uid: 'abc', href: '/d/abc?from=now-1h&to=now', lastVisited: T0 },
    ]);
  });

  it('refreshes the href on query churn instead of adding a row', async () => {
    const srv = startAt('/d/abc?from=now-1h&to=now');
    await srv.getEntries();

    jest.setSystemTime(T1);
    locationService.partial({ from: 'now-6h' });

    expect(await srv.getEntries()).toEqual([
      { kind: 'dashboard', uid: 'abc', href: '/d/abc?from=now-6h&to=now', lastVisited: T1 },
    ]);
  });

  it('treats a flagged REPLACE as an in-place rewrite', async () => {
    const srv = startAt('/d/abc?from=now-6h&to=now');
    await srv.getEntries();

    locationService.replace(markAsUrlRewrite({ pathname: '/d/abc/slug', search: '?from=now-6h&to=now' }));

    expect(await srv.getEntries()).toEqual([
      expect.objectContaining({ uid: 'abc', href: '/d/abc/slug?from=now-6h&to=now' }),
    ]);
  });

  it('records an unflagged REPLACE to another page as a new row', async () => {
    const srv = startAt('/d/abc');
    await srv.getEntries();

    locationService.replace('/d/xyz');

    expect((await srv.getEntries()).map((e) => e.href)).toEqual(['/d/xyz', '/d/abc']);
  });

  it('moves revisited pages to the top, including on POP', async () => {
    const srv = startAt('/d/abc');
    await srv.getEntries();

    locationService.push('/explore?schemaVersion=1&panes=%7B%7D');
    locationService.push('/d/abc');

    expect((await srv.getEntries()).map((e) => e.kind)).toEqual(['dashboard', 'explore']);

    locationService.getHistory().goBack();

    expect(await srv.getEntries()).toEqual([
      expect.objectContaining({ kind: 'explore', href: '/explore?schemaVersion=1&panes=%7B%7D' }),
      expect.objectContaining({ kind: 'dashboard', uid: 'abc' }),
    ]);
  });

  it('keeps the latest event first within the same millisecond', async () => {
    const srv = startAt('/');
    await srv.getEntries();

    locationService.push('/alerting/list');
    locationService.push('/alerting/silences');

    expect((await srv.getEntries()).map((e) => e.href)).toEqual(['/alerting/silences', '/alerting/list']);
  });

  it('classifies pages and ignores unlisted ones', async () => {
    const srv = startAt('/');
    await srv.getEntries();

    locationService.push('/a/grafana-ml-app/investigations/123?x=1');
    locationService.push('/a/grafana-ml-app/investigations');
    locationService.push('/alerting/list?search=x');
    locationService.push('/dashboards');

    expect(await srv.getEntries()).toEqual([
      { kind: 'alerting', pathname: '/alerting/list', href: '/alerting/list?search=x', lastVisited: T0 },
      {
        kind: 'app',
        pathname: '/a/grafana-ml-app/investigations',
        href: '/a/grafana-ml-app/investigations',
        lastVisited: T0,
      },
      {
        kind: 'investigation',
        pluginId: 'grafana-ml-app',
        id: '123',
        href: '/a/grafana-ml-app/investigations/123?x=1',
        lastVisited: T0,
      },
    ]);
  });

  it('stamps the title a page sets in the chrome onto that page, newest nav wins', async () => {
    const srv = startAt('/alerting/list');
    await srv.getEntries();
    expect((await srv.getEntries())[0].title).toBeUndefined();

    renderPage('Alert rules', 'Alerting');
    locationService.push('/alerting/grafana/abc/view');
    // The route-change placeholder (empty main, no pageNav) must not be taken as the new page's title.
    chrome.update({ sectionNav: { node: { text: 'Home' }, main: { text: '' } }, pageNav: undefined });
    renderPage('Alert rules', 'Alerting', 'High CPU');
    locationService.push('/dashboards');
    renderPage('Dashboards', 'Dashboards');

    expect(await srv.getEntries()).toEqual([
      expect.objectContaining({ href: '/alerting/grafana/abc/view', title: 'High CPU' }),
      expect.objectContaining({ href: '/alerting/list', title: 'Alert rules' }),
    ]);

    await jest.advanceTimersByTimeAsync(1000);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual([
      { href: '/alerting/grafana/abc/view', lastVisited: T0, title: 'High CPU' },
      { href: '/alerting/list', lastVisited: T0, title: 'Alert rules' },
    ]);
  });

  it('ignores the home dashboard rewrite', async () => {
    const srv = startAt('/');
    await srv.getEntries();

    locationService.replace(markAsUrlRewrite('/d/home-uid/home'));

    expect(await srv.getEntries()).toEqual([]);
  });

  it('caps the list by count and by stored size, evicting the oldest first', async () => {
    const srv = startAt('/');
    await srv.getEntries();

    for (let i = 0; i <= PAGE_HISTORY_MAX; i++) {
      locationService.push(`/d/${i}`);
    }

    const byCount = await srv.getEntries();
    expect(byCount).toHaveLength(PAGE_HISTORY_MAX);
    expect(byCount[0]).toEqual(expect.objectContaining({ uid: `${PAGE_HISTORY_MAX}` }));
    expect(byCount.some((e) => e.kind === 'dashboard' && e.uid === '0')).toBe(false);

    const bigQuery = `?q=${'x'.repeat(3000)}`;
    for (let i = 0; i < 70; i++) {
      locationService.push(`/d/big-${i}${bigQuery}`);
    }
    await jest.advanceTimersByTimeAsync(1000);

    const byBytes = await srv.getEntries();
    expect(byBytes.length).toBeLessThan(70);
    expect(window.localStorage.getItem(STORAGE_KEY)!.length).toBeLessThanOrEqual(PAGE_HISTORY_MAX_BYTES);
    // Every surviving row is one of the newest pushes, contiguous from the top.
    expect(byBytes.map((e) => e.kind === 'dashboard' && e.uid)).toEqual(
      Array.from({ length: byBytes.length }, (_, i) => `big-${69 - i}`)
    );
  });

  it('persists href and time once per debounce window', async () => {
    const setSpy = jest.spyOn(store, 'set');
    const srv = startAt('/d/abc');
    await srv.getEntries();

    locationService.push('/d/def');
    locationService.push('/d/ghi');
    jest.advanceTimersByTime(999);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();

    await jest.advanceTimersByTimeAsync(1);

    expect(setSpy.mock.calls.filter(([key]) => key === STORAGE_KEY)).toHaveLength(1);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual(stored(await srv.getEntries()));
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
    expect(first).toEqual([expect.objectContaining({ uid: 'abc' })]);

    await jest.advanceTimersByTimeAsync(1000);
    await settle();

    expect(posts).toEqual([
      {
        metadata: { name: 'grafana-page-history:abc', labels: { user: 'abc', service: 'grafana-page-history' } },
        spec: { data: { 'org-1': JSON.stringify(stored(first)) } },
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
        body: { spec: { data: { 'org-1': JSON.stringify(stored(await srv.getEntries())) } } },
      },
    ]);
  });

  it('flushes the pending write when the tab is hidden', async () => {
    const srv = startAt('/d/abc');
    await srv.getEntries();

    locationService.push('/d/def');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await jest.advanceTimersByTimeAsync(0);

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual(stored(await srv.getEntries()));
  });

  it('loads the stored copy, deriving each page from its href and dropping bad rows', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { href: '/d/old', lastVisited: 100 },
        { href: '/explore?a=1', lastVisited: 300 },
        // Same page twice: the newer visit wins.
        { href: '/explore?a=2', lastVisited: 200 },
        // Rows written by an earlier format still load; extra fields are ignored.
        { key: 'dashboard:legacy', kind: 'dashboard', href: '/d/legacy', lastVisited: 150, visits: 3 },
        { href: '/d/x' },
        { href: 'https://evil.example/d/x', lastVisited: 400 },
        // Valid URL that is not a page worth resuming.
        { href: '/dashboards?query=x', lastVisited: 400 },
      ])
    );

    const srv = startAt('/alerting/list');

    expect(await srv.getEntries()).toEqual([
      { kind: 'alerting', pathname: '/alerting/list', href: '/alerting/list', lastVisited: T0 },
      { kind: 'explore', href: '/explore?a=1', lastVisited: 300 },
      { kind: 'dashboard', uid: 'legacy', href: '/d/legacy', lastVisited: 150 },
      { kind: 'dashboard', uid: 'old', href: '/d/old', lastVisited: 100 },
    ]);
  });

  it('keeps pages visited before the load finished and merges the stored copy underneath', async () => {
    const deferred = createDeferred<string | null>();
    jest.spyOn(UserStorage.prototype, 'getItem').mockReturnValue(deferred.promise);
    const setSpy = jest.spyOn(UserStorage.prototype, 'setItem').mockResolvedValue();

    const srv = startAt('/');
    jest.setSystemTime(T1);
    locationService.push('/d/a');
    jest.setSystemTime(T2);
    locationService.push('/d/b');
    // The debounced write fires before the load resolves and must wait for it.
    await jest.advanceTimersByTimeAsync(1000);
    expect(setSpy).not.toHaveBeenCalled();

    jest.setSystemTime(T3);
    deferred.resolve(
      JSON.stringify([
        { href: '/d/a?from=now-7d', lastVisited: T0 },
        { href: '/d/c', lastVisited: T0 },
      ])
    );

    const entries = await srv.getEntries();
    expect(entries).toEqual([
      { kind: 'dashboard', uid: 'b', href: '/d/b', lastVisited: T2 },
      { kind: 'dashboard', uid: 'a', href: '/d/a', lastVisited: T1 },
      { kind: 'dashboard', uid: 'c', href: '/d/c', lastVisited: T0 },
    ]);
    await jest.advanceTimersByTimeAsync(0);
    expect(setSpy).toHaveBeenCalledWith('org-1', JSON.stringify(stored(entries)));
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
    await jest.advanceTimersByTimeAsync(2000);

    expect(setSpy).not.toHaveBeenCalled();
    expect(await new PageHistorySrv().getEntries()).toEqual([]);
  });
});
