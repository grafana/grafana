import { createMemoryHistory } from 'history';

import { type NavModelItem, store } from '@grafana/data';
import { config, HistoryWrapper, locationService, setLocationService } from '@grafana/runtime';
import { UserStorage } from '@grafana/runtime/internal';
import { AppChromeService } from 'app/core/components/AppChrome/AppChromeService';
import { markAsUrlRewrite } from 'app/core/navigation/urlRewrite';
import { contextSrv } from 'app/core/services/context_srv';

import { PAGE_HISTORY_PERSIST_MS, PageHistorySrv } from './pageHistorySrv';
import { PAGE_HISTORY_MAX_ENTRY_CHARS, PAGE_HISTORY_MAX_PER_KIND } from './pageHistoryState';
import { type PageHistoryEntry } from './types';

/** UserStorage's localStorage fallback key for the anonymous user. */
const STORAGE_KEY = 'grafana-page-history:0:history';

const T0 = 1_700_000_000_000;
const T1 = T0 + 60_000;
const T2 = T0 + 120_000;
const T3 = T0 + 180_000;

let stop: (() => void) | undefined;
const originalUser = { ...config.bootData.user };
const originalAuthenticatedBy = contextSrv.user.authenticatedBy;

let chrome: AppChromeService;

/** Starts a service at `path`; `navTree` is read on every visit, so a test can change what the menu links to. */
function startAt(path: string, navTree: NavModelItem[] = []) {
  setLocationService(new HistoryWrapper(createMemoryHistory({ initialEntries: [path] })));
  chrome = new AppChromeService();
  const srv = new PageHistorySrv();
  stop = srv.start(chrome, () => navTree);
  return srv;
}

/** What a rendered page does: sets its section, optionally a page-specific nav. */
function renderPage(section: string, main: string, pageNav?: string) {
  chrome.update({
    sectionNav: { node: { text: section }, main: { text: main } },
    pageNav: pageNav ? { text: pageNav } : undefined,
  });
}

/** The stored envelope for a never-cleared history. */
function stored(entries: PageHistoryEntry[]) {
  return {
    clearedAt: 0,
    entries: entries.map(({ pathname, search, lastVisited }) => ({ pathname, search, lastVisited })),
  };
}

/** Explore's v1 search for one session (the left pane's id), with any extra params appended. */
function exploreSearch(session: string, extra = '') {
  return `?schemaVersion=1&panes=${encodeURIComponent(JSON.stringify({ [session]: {} }))}${extra}`;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function hideTab() {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  jest.useFakeTimers({ now: T0 });
  window.localStorage.clear();
  // Anonymous user: UserStorage keys on `uid || id`.
  config.bootData.user.uid = '';
  config.bootData.user.id = 0;
  config.bootData.user.isSignedIn = false;
});

afterEach(() => {
  stop?.();
  stop = undefined;
  jest.useRealTimers();
  jest.restoreAllMocks();
  Object.assign(config.bootData.user, originalUser);
  contextSrv.user.authenticatedBy = originalAuthenticatedBy;
  Reflect.deleteProperty(document, 'visibilityState');
});

describe('PageHistorySrv', () => {
  it('records the landing page', async () => {
    const srv = startAt('/d/abc?from=now-1h&to=now');

    expect(await srv.getEntries()).toEqual([
      { kind: 'dashboard', uid: 'abc', pathname: '/d/abc', search: '?from=now-1h&to=now', lastVisited: T0 },
    ]);
  });

  it('records a dashboard without the params that reopen its editors', async () => {
    const srv = startAt('/');
    await srv.getEntries();

    locationService.push('/d/abc?from=now-1h&to=now&editPanel=3');

    expect(await srv.getEntries()).toEqual([
      { kind: 'dashboard', uid: 'abc', pathname: '/d/abc', search: '?from=now-1h&to=now', lastVisited: T0 },
    ]);
  });

  it('records nothing for a renderer session', async () => {
    contextSrv.user.authenticatedBy = 'render';
    const srv = startAt('/d/abc');

    locationService.push('/d/def');
    await jest.advanceTimersByTimeAsync(PAGE_HISTORY_PERSIST_MS);
    hideTab();
    await jest.advanceTimersByTimeAsync(0);

    expect(await srv.getEntries()).toEqual([]);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('records an unflagged REPLACE to another page as a new row', async () => {
    const srv = startAt('/d/abc');
    await srv.getEntries();

    locationService.replace('/d/xyz');

    expect((await srv.getEntries()).map((e) => e.pathname)).toEqual(['/d/xyz', '/d/abc']);
  });

  it('moves revisited pages to the top, including on POP', async () => {
    const srv = startAt('/d/abc');
    await srv.getEntries();

    locationService.push(`/explore${exploreSearch('abc')}`);
    locationService.push('/d/abc');

    expect((await srv.getEntries()).map((e) => e.kind)).toEqual(['dashboard', 'explore']);

    locationService.getHistory().goBack();

    expect(await srv.getEntries()).toEqual([
      expect.objectContaining({ kind: 'explore', session: 'abc', search: exploreSearch('abc') }),
      expect.objectContaining({ kind: 'dashboard', uid: 'abc' }),
    ]);
  });

  it('records each Explore session as its own row, keyed by the left pane', async () => {
    const srv = startAt('/d/abc');
    await srv.getEntries();

    // Explore mounts with a bare URL, then writes its state with a plain REPLACE on the same pathname.
    locationService.push('/explore');
    expect((await srv.getEntries()).map((e) => e.kind)).toEqual(['dashboard']);
    locationService.replace(`/explore${exploreSearch('abc')}`);
    // Query edits and a split keep the row and refresh its state.
    locationService.replace(`/explore${exploreSearch('abc', '&x=1')}`);

    expect(await srv.getEntries()).toEqual([
      expect.objectContaining({ kind: 'explore', session: 'abc', search: exploreSearch('abc', '&x=1') }),
      expect.objectContaining({ kind: 'dashboard', uid: 'abc' }),
    ]);

    // Opening Explore again starts another session.
    locationService.push('/d/abc');
    locationService.push('/explore');
    locationService.replace(`/explore${exploreSearch('xyz')}`);

    expect((await srv.getEntries()).map((e) => (e.kind === 'explore' ? e.session : e.kind))).toEqual([
      'xyz',
      'dashboard',
      'abc',
    ]);
  });

  it('classifies pages and ignores unlisted ones', async () => {
    const srv = startAt('/');
    await srv.getEntries();

    locationService.push('/a/grafana-irm-app/incidents/5987?x=1');
    locationService.push('/a/grafana-irm-app/incidents');
    locationService.push('/alerting/list?search=x');
    locationService.push('/dashboards');

    // Every stamp goes past the previous one, even within a millisecond.
    expect(await srv.getEntries()).toEqual([
      { kind: 'alerting', pathname: '/alerting/list', search: '?search=x', lastVisited: T0 + 2 },
      { kind: 'app', pathname: '/a/grafana-irm-app/incidents', search: '', lastVisited: T0 + 1 },
      { kind: 'app', pathname: '/a/grafana-irm-app/incidents/5987', search: '?x=1', lastVisited: T0 },
    ]);
  });

  it('gives a menu destination no row of its own, but refreshes the row it has to where the user left it', async () => {
    const navTree: NavModelItem[] = [{ text: 'Alert rules', url: '/alerting/list' }];
    const srv = startAt('/alerting/list?orgId=1', navTree);
    await srv.getEntries();
    expect(await srv.getEntries()).toEqual([]);

    locationService.push('/alerting/list?search=firing');
    expect(await srv.getEntries()).toEqual([
      { kind: 'alerting', pathname: '/alerting/list', search: '?search=firing', lastVisited: T0 },
    ]);

    // Clearing the filter is the state the user left the page in; the row must not restore the filter.
    locationService.push('/alerting/list?orgId=1');
    expect(await srv.getEntries()).toEqual([
      { kind: 'alerting', pathname: '/alerting/list', search: '?orgId=1', lastVisited: T0 + 1 },
    ]);
  });

  it('refreshes a stored row when the landing page is a menu destination, and titles it', async () => {
    // Signed-in users read the store over the network: the landing visit and the first title arrive before it.
    const deferred = createDeferred<string | null>();
    jest.spyOn(UserStorage.prototype, 'updateItem').mockImplementation(async (_key, update) => {
      update(await deferred.promise);
    });
    const navTree: NavModelItem[] = [{ text: 'Alert rules', url: '/alerting/list' }];

    const srv = startAt('/alerting/list?orgId=1', navTree);
    renderPage('Alert rules', 'Alerting');
    deferred.resolve(
      JSON.stringify({
        clearedAt: 0,
        entries: [{ pathname: '/alerting/list', search: '?search=firing', lastVisited: T0 - 60_000 }],
      })
    );

    expect(await srv.getEntries()).toEqual([
      { kind: 'alerting', pathname: '/alerting/list', search: '?orgId=1', lastVisited: T0 + 1, title: 'Alert rules' },
    ]);
  });

  it('reads the menu as it is at each visit, not as it was at start', async () => {
    const navTree: NavModelItem[] = [];
    const srv = startAt('/', navTree);
    await srv.getEntries();

    // The client-built menu fills in after start (permissions, plugins); a visit after that sees it.
    navTree.push({ text: 'Incidents', url: '/a/grafana-irm-app/incidents' });
    locationService.push('/a/grafana-irm-app/incidents');

    expect(await srv.getEntries()).toEqual([]);
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
      expect.objectContaining({ pathname: '/alerting/grafana/abc/view', title: 'High CPU' }),
      expect.objectContaining({ pathname: '/alerting/list', title: 'Alert rules' }),
    ]);

    await jest.advanceTimersByTimeAsync(PAGE_HISTORY_PERSIST_MS);
    // A title is a revision of its row: it takes a new stamp.
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual({
      clearedAt: 0,
      entries: [
        { pathname: '/alerting/grafana/abc/view', search: '', lastVisited: T0 + 3, title: 'High CPU' },
        { pathname: '/alerting/list', search: '', lastVisited: T0 + 1, title: 'Alert rules' },
      ],
    });
  });

  it('leaves a new row within one route untitled until its own page sets its nav', async () => {
    const srv = startAt('/a/grafana-irm-app/incidents/1');
    await srv.getEntries();
    // Both incident pages match `/a/:pluginId/*`, so the chrome keeps the first page's nav across the navigation.
    chrome.setMatchedRoute({ path: '/a/:pluginId/*', component: () => null });
    renderPage('Incidents', 'IRM', 'Incident 1');

    locationService.push('/a/grafana-irm-app/incidents/2');
    chrome.setMegaMenuOpen(true); // a chrome change before the new page renders is not the new page's nav

    expect((await srv.getEntries())[0]).toEqual({
      kind: 'app',
      pathname: '/a/grafana-irm-app/incidents/2',
      search: '',
      lastVisited: T0 + 2,
    });

    renderPage('Incidents', 'IRM', 'Incident 2');

    expect((await srv.getEntries()).map((e) => e.title)).toEqual(['Incident 2', 'Incident 1']);
  });

  it('ignores the home dashboard rewrite', async () => {
    const srv = startAt('/');
    await srv.getEntries();

    locationService.replace(markAsUrlRewrite('/d/home-uid/home'));

    expect(await srv.getEntries()).toEqual([]);
  });

  it('persists 30s after the first change; later changes do not postpone it', async () => {
    const setSpy = jest.spyOn(store, 'set');
    const writes = () => setSpy.mock.calls.filter(([key]) => key === STORAGE_KEY);
    const srv = startAt('/d/abc');
    await srv.getEntries();

    locationService.push('/d/def');
    await jest.advanceTimersByTimeAsync(10_000);
    locationService.push('/d/ghi');
    await jest.advanceTimersByTimeAsync(PAGE_HISTORY_PERSIST_MS - 10_000 - 1);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();

    await jest.advanceTimersByTimeAsync(1);

    expect(writes()).toHaveLength(1);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual(stored(await srv.getEntries()));
    expect((await srv.getEntries()).map((e) => e.pathname)).toEqual(['/d/ghi', '/d/def', '/d/abc']);

    await jest.advanceTimersByTimeAsync(10_000);
    expect(writes()).toHaveLength(1);
  });

  it('merges rows another tab stored before writing', async () => {
    const srv = startAt('/alerting/list');
    locationService.push('/d/a');
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ clearedAt: 0, entries: [{ pathname: '/d/b', search: '', lastVisited: T0 - 1 }] })
    );

    await jest.advanceTimersByTimeAsync(PAGE_HISTORY_PERSIST_MS);

    const expected: PageHistoryEntry[] = [
      { kind: 'dashboard', uid: 'a', pathname: '/d/a', search: '', lastVisited: T0 + 1 },
      { kind: 'alerting', pathname: '/alerting/list', search: '', lastVisited: T0 },
      { kind: 'dashboard', uid: 'b', pathname: '/d/b', search: '', lastVisited: T0 - 1 },
    ];
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual(stored(expected));
    expect(await srv.getEntries()).toEqual(expected);
  });

  it('keeps a failed write in memory and retries it with the next change or when the tab is hidden', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const srv = startAt('/d/abc');
    await srv.getEntries();
    const updateSpy = jest.spyOn(UserStorage.prototype, 'updateItem').mockRejectedValue(new Error('down'));

    locationService.push('/d/def');
    await jest.advanceTimersByTimeAsync(PAGE_HISTORY_PERSIST_MS * 3);
    // One attempt: a window that failed does not re-arm itself while storage is down.
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();

    locationService.push('/d/ghi');
    await jest.advanceTimersByTimeAsync(PAGE_HISTORY_PERSIST_MS);
    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();

    updateSpy.mockRestore();
    hideTab();
    await jest.advanceTimersByTimeAsync(0);
    const entries = await srv.getEntries();
    expect(entries.map((e) => e.pathname)).toEqual(['/d/ghi', '/d/def', '/d/abc']);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual(stored(entries));
  });

  it('skips the write when the stored copy already matches', async () => {
    const srv = startAt('/d/a');
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored(await srv.getEntries())));
    const updateSpy = jest.spyOn(UserStorage.prototype, 'updateItem');
    const setSpy = jest.spyOn(store, 'set');

    await jest.advanceTimersByTimeAsync(PAGE_HISTORY_PERSIST_MS);

    expect(updateSpy).toHaveBeenCalled();
    expect(setSpy.mock.calls.filter(([key]) => key === STORAGE_KEY)).toHaveLength(0);
  });

  it('flushes the pending write when the tab is hidden', async () => {
    const srv = startAt('/d/abc');
    await srv.getEntries();

    locationService.push('/d/def');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();

    hideTab();
    await jest.advanceTimersByTimeAsync(0);

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual(stored(await srv.getEntries()));
  });

  it('loads the stored copy, deriving each page from its pathname and dropping bad rows', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        clearedAt: 0,
        entries: [
          // A trailing slash is normalized away on load.
          { pathname: '/d/old/', search: '', lastVisited: 100 },
          { pathname: '/explore', search: exploreSearch('abc', '&a=1'), lastVisited: 300 },
          // Same Explore session twice: the newer visit wins. Another session is another row.
          { pathname: '/explore', search: exploreSearch('abc', '&a=2'), lastVisited: 200 },
          { pathname: '/explore', search: exploreSearch('xyz'), lastVisited: 250 },
          // Explore before it wrote its state.
          { pathname: '/explore', search: '', lastVisited: 400 },
          // Rows written by an earlier format still load; extra fields are ignored.
          {
            key: 'dashboard:legacy',
            kind: 'dashboard',
            pathname: '/d/legacy',
            search: '',
            lastVisited: 150,
            visits: 3,
          },
          { pathname: '/d/x', search: '', lastVisited: 'yesterday' },
          // Seeded from the recently-viewed impressions: no visit time.
          { pathname: '/d/seeded', search: '' },
          { pathname: '//evil.example/d/x', search: '', lastVisited: 400 },
          { pathname: '/d/y', search: 'from=now-1h', lastVisited: 400 },
          // Valid row that is not a page worth resuming.
          { pathname: '/dashboards', search: '?query=x', lastVisited: 400 },
          // Oversized rows written before the per-entry cap drop on load like any other bad row.
          {
            pathname: '/explore',
            search: exploreSearch('big', `&q=${'x'.repeat(PAGE_HISTORY_MAX_ENTRY_CHARS)}`),
            lastVisited: 500,
          },
        ],
      })
    );

    const srv = startAt('/alerting/list');

    expect(await srv.getEntries()).toEqual([
      { kind: 'alerting', pathname: '/alerting/list', search: '', lastVisited: T0 },
      { kind: 'explore', session: 'abc', pathname: '/explore', search: exploreSearch('abc', '&a=1'), lastVisited: 300 },
      { kind: 'explore', session: 'xyz', pathname: '/explore', search: exploreSearch('xyz'), lastVisited: 250 },
      { kind: 'dashboard', uid: 'legacy', pathname: '/d/legacy', search: '', lastVisited: 150 },
      { kind: 'dashboard', uid: 'old', pathname: '/d/old', search: '', lastVisited: 100 },
      { kind: 'dashboard', uid: 'seeded', pathname: '/d/seeded', search: '' },
    ]);
  });

  it('keeps pages visited before the load finished and merges the stored copy underneath', async () => {
    const deferred = createDeferred<string | null>();
    const writes: string[] = [];
    jest.spyOn(UserStorage.prototype, 'updateItem').mockImplementation(async (_key, update) => {
      const next = update(await deferred.promise);
      if (next !== undefined) {
        writes.push(next);
      }
    });

    const srv = startAt('/');
    jest.setSystemTime(T1);
    locationService.push('/d/a');
    jest.setSystemTime(T2);
    locationService.push('/d/b');
    // The throttled write fires before the load resolves and must wait for it.
    await jest.advanceTimersByTimeAsync(PAGE_HISTORY_PERSIST_MS);
    expect(writes).toEqual([]);

    jest.setSystemTime(T3);
    deferred.resolve(
      JSON.stringify({
        clearedAt: 0,
        entries: [
          { pathname: '/d/a', search: '?from=now-7d', lastVisited: T0 },
          { pathname: '/d/c', search: '', lastVisited: T0 },
        ],
      })
    );

    const entries = await srv.getEntries();
    expect(entries).toEqual([
      { kind: 'dashboard', uid: 'b', pathname: '/d/b', search: '', lastVisited: T2 },
      { kind: 'dashboard', uid: 'a', pathname: '/d/a', search: '', lastVisited: T1 },
      { kind: 'dashboard', uid: 'c', pathname: '/d/c', search: '', lastVisited: T0 },
    ]);
    await jest.advanceTimersByTimeAsync(0);
    expect(writes.map((raw) => JSON.parse(raw))).toEqual([stored(entries)]);
  });

  describe('seeding from the recently-viewed impressions', () => {
    // impressionSrv keys its localStorage list on the org.
    const IMPRESSIONS_KEY = 'dashboard_impressions-1';
    const originalOrgId = contextSrv.user.orgId;
    beforeEach(() => {
      contextSrv.user.orgId = 1;
    });
    afterEach(() => {
      contextSrv.user.orgId = originalOrgId;
    });
    const uids = Array.from({ length: 12 }, (_, i) => `d${i + 1}`);
    const seededRows = uids.slice(0, PAGE_HISTORY_MAX_PER_KIND).map((uid) => ({ pathname: `/d/${uid}`, search: '' }));
    const seededEntries = seededRows.map((row) => ({ kind: 'dashboard', uid: row.pathname.slice(3), ...row }));

    it('seeds the newest dashboards on first use, once', async () => {
      window.localStorage.setItem(IMPRESSIONS_KEY, JSON.stringify(uids));

      let srv = startAt('/');
      expect(await srv.getEntries()).toEqual(seededEntries);
      expect((await srv.getEntries()).every((e) => !('lastVisited' in e))).toBe(true);
      await jest.advanceTimersByTimeAsync(PAGE_HISTORY_PERSIST_MS);
      expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual({ clearedAt: 0, entries: seededRows });

      // A stored envelope, whatever it holds, means seeding is over.
      stop?.();
      window.localStorage.setItem(IMPRESSIONS_KEY, JSON.stringify(['other']));
      srv = startAt('/');
      expect(await srv.getEntries()).toEqual(seededEntries);

      jest.setSystemTime(T3);
      await srv.clear();
      expect(await srv.getEntries()).toEqual([]);
      expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual({ clearedAt: T3, entries: [] });

      stop?.();
      srv = startAt('/');
      expect(await srv.getEntries()).toEqual([]);
    });

    it('does not seed from corrupt impressions and does not retry', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      window.localStorage.setItem(IMPRESSIONS_KEY, '{not json');

      let srv = startAt('/');
      expect(await srv.getEntries()).toEqual([]);
      await jest.advanceTimersByTimeAsync(PAGE_HISTORY_PERSIST_MS);
      expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual({ clearedAt: 0, entries: [] });

      stop?.();
      window.localStorage.setItem(IMPRESSIONS_KEY, JSON.stringify(uids));
      srv = startAt('/');
      expect(await srv.getEntries()).toEqual([]);
    });

    it('sorts seeded rows after recorded pages and evicts them first', async () => {
      window.localStorage.setItem(IMPRESSIONS_KEY, JSON.stringify(uids));
      const srv = startAt('/');
      await srv.getEntries();

      locationService.push('/d/new');

      const entries = await srv.getEntries();
      expect(entries[0]).toEqual({ kind: 'dashboard', uid: 'new', pathname: '/d/new', search: '', lastVisited: T0 });
      expect(entries).toHaveLength(PAGE_HISTORY_MAX_PER_KIND);
      expect(entries.map((e) => e.pathname)).not.toContain('/d/d10');
    });
  });

  it('stops recording and drops the pending write when stopped; returns nothing when never started', async () => {
    const setSpy = jest.spyOn(store, 'set');
    const srv = startAt('/d/abc');
    await srv.getEntries();
    locationService.push('/d/def');

    stop?.();
    locationService.push('/d/ghi');
    hideTab();
    await jest.advanceTimersByTimeAsync(PAGE_HISTORY_PERSIST_MS * 2);

    expect((await srv.getEntries()).map((e) => e.pathname)).toEqual(['/d/def', '/d/abc']);
    expect(setSpy.mock.calls.filter(([key]) => key === STORAGE_KEY)).toHaveLength(0);
    expect(await new PageHistorySrv().getEntries()).toEqual([]);
  });
});
