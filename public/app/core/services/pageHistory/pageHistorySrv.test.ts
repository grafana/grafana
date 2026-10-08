import { createMemoryHistory } from 'history';

import { store } from '@grafana/data';
import { config, HistoryWrapper, locationService, setLocationService } from '@grafana/runtime';
import { UserStorage } from '@grafana/runtime/internal';
import { AppChromeService } from 'app/core/components/AppChrome/AppChromeService';
import { markAsUrlRewrite } from 'app/core/navigation/urlRewrite';
import { contextSrv } from 'app/core/services/context_srv';

import { PAGE_HISTORY_MAX_ENTRY_CHARS, PageHistorySrv } from './pageHistorySrv';
import { PAGE_HISTORY_MAX_PER_KIND, type PageHistoryEntry } from './types';

/** UserStorage's localStorage fallback key for the anonymous user in org 1. */
const STORAGE_KEY = 'grafana-page-history:0:org-1';

const T0 = 1_700_000_000_000;
const T1 = T0 + 60_000;
const T2 = T0 + 120_000;
const T3 = T0 + 180_000;

let stop: (() => void) | undefined;
const originalUser = { ...config.bootData.user };
const originalOrgId = contextSrv.user.orgId;

let chrome: AppChromeService;

function startAt(path: string) {
  setLocationService(new HistoryWrapper(createMemoryHistory({ initialEntries: [path] })));
  chrome = new AppChromeService();
  const srv = new PageHistorySrv();
  stop = srv.start(chrome);
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
  return entries.map(({ pathname, search, lastVisited }) => ({ pathname, search, lastVisited }));
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
  // Anonymous user in org 1: UserStorage keys on `uid || id`, the service keys on `contextSrv.user.orgId`.
  config.bootData.user.uid = '';
  config.bootData.user.id = 0;
  config.bootData.user.isSignedIn = false;
  contextSrv.user.orgId = 1;
});

afterEach(() => {
  stop?.();
  stop = undefined;
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
      { kind: 'dashboard', uid: 'abc', pathname: '/d/abc', search: '?from=now-1h&to=now', lastVisited: T0 },
    ]);
  });

  it('refreshes the search on query churn instead of adding a row', async () => {
    const srv = startAt('/d/abc?from=now-1h&to=now');
    await srv.getEntries();

    jest.setSystemTime(T1);
    locationService.partial({ from: 'now-6h' });

    expect(await srv.getEntries()).toEqual([
      { kind: 'dashboard', uid: 'abc', pathname: '/d/abc', search: '?from=now-6h&to=now', lastVisited: T1 },
    ]);
  });

  it('treats a flagged REPLACE as an in-place rewrite', async () => {
    const srv = startAt('/d/abc?from=now-6h&to=now');
    await srv.getEntries();

    locationService.replace(markAsUrlRewrite({ pathname: '/d/abc/slug', search: '?from=now-6h&to=now' }));

    expect(await srv.getEntries()).toEqual([
      expect.objectContaining({ uid: 'abc', pathname: '/d/abc/slug', search: '?from=now-6h&to=now' }),
    ]);
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

  it('keeps the latest event first within the same millisecond', async () => {
    const srv = startAt('/');
    await srv.getEntries();

    locationService.push('/alerting/list');
    locationService.push('/alerting/silences');

    expect((await srv.getEntries()).map((e) => e.pathname)).toEqual(['/alerting/silences', '/alerting/list']);
  });

  it('classifies pages and ignores unlisted ones', async () => {
    const srv = startAt('/');
    await srv.getEntries();

    locationService.push('/a/grafana-irm-app/incidents/5987?x=1');
    locationService.push('/a/grafana-irm-app/incidents');
    locationService.push('/alerting/list?search=x');
    locationService.push('/dashboards');

    expect(await srv.getEntries()).toEqual([
      { kind: 'alerting', pathname: '/alerting/list', search: '?search=x', lastVisited: T0 },
      { kind: 'app', pathname: '/a/grafana-irm-app/incidents', search: '', lastVisited: T0 },
      { kind: 'app', pathname: '/a/grafana-irm-app/incidents/5987', search: '?x=1', lastVisited: T0 },
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
      expect.objectContaining({ pathname: '/alerting/grafana/abc/view', title: 'High CPU' }),
      expect.objectContaining({ pathname: '/alerting/list', title: 'Alert rules' }),
    ]);

    await jest.advanceTimersByTimeAsync(1000);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual([
      { pathname: '/alerting/grafana/abc/view', search: '', lastVisited: T0, title: 'High CPU' },
      { pathname: '/alerting/list', search: '', lastVisited: T0, title: 'Alert rules' },
    ]);
  });

  it('ignores the home dashboard rewrite', async () => {
    const srv = startAt('/');
    await srv.getEntries();

    locationService.replace(markAsUrlRewrite('/d/home-uid/home'));

    expect(await srv.getEntries()).toEqual([]);
  });

  it('keeps the newest pages per kind', async () => {
    const srv = startAt('/alerting/list');
    await srv.getEntries();

    for (let i = 0; i <= PAGE_HISTORY_MAX_PER_KIND; i++) {
      locationService.push(`/d/${i}`);
    }

    expect((await srv.getEntries()).map((e) => e.pathname)).toEqual([
      ...Array.from({ length: PAGE_HISTORY_MAX_PER_KIND }, (_, i) => `/d/${PAGE_HISTORY_MAX_PER_KIND - i}`),
      // A burst of dashboards never pushes out another kind.
      '/alerting/list',
    ]);
  });

  it('does not record a URL too large to store and leaves the rest of the history alone', async () => {
    const srv = startAt('/alerting/list');
    locationService.push('/d/abc?from=now-1h&to=now');
    await jest.advanceTimersByTimeAsync(1000);
    const before = await srv.getEntries();

    const filler = `&q=${'x'.repeat(PAGE_HISTORY_MAX_ENTRY_CHARS)}`;
    locationService.push(`/explore${exploreSearch('big', filler)}`);
    // Oversized churn on a recorded page keeps its earlier state rather than dropping the row.
    locationService.push(`/d/abc?${filler.slice(1)}`);
    await jest.advanceTimersByTimeAsync(1000);

    expect(await srv.getEntries()).toEqual(before);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual(stored(before));

    locationService.push(`/explore${exploreSearch('abc')}`);
    expect((await srv.getEntries()).map((e) => e.pathname)).toEqual(['/explore', '/d/abc', '/alerting/list']);
  });

  it('persists once per debounce window', async () => {
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
      JSON.stringify([
        // A trailing slash is normalized away on load.
        { pathname: '/d/old/', search: '', lastVisited: 100 },
        { pathname: '/explore', search: exploreSearch('abc', '&a=1'), lastVisited: 300 },
        // Same Explore session twice: the newer visit wins. Another session is another row.
        { pathname: '/explore', search: exploreSearch('abc', '&a=2'), lastVisited: 200 },
        { pathname: '/explore', search: exploreSearch('xyz'), lastVisited: 250 },
        // Explore before it wrote its state.
        { pathname: '/explore', search: '', lastVisited: 400 },
        // Rows written by an earlier format still load; extra fields are ignored.
        { key: 'dashboard:legacy', kind: 'dashboard', pathname: '/d/legacy', search: '', lastVisited: 150, visits: 3 },
        { pathname: '/d/x', search: '' },
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
      ])
    );

    const srv = startAt('/alerting/list');

    expect(await srv.getEntries()).toEqual([
      { kind: 'alerting', pathname: '/alerting/list', search: '', lastVisited: T0 },
      { kind: 'explore', session: 'abc', pathname: '/explore', search: exploreSearch('abc', '&a=1'), lastVisited: 300 },
      { kind: 'explore', session: 'xyz', pathname: '/explore', search: exploreSearch('xyz'), lastVisited: 250 },
      { kind: 'dashboard', uid: 'legacy', pathname: '/d/legacy', search: '', lastVisited: 150 },
      { kind: 'dashboard', uid: 'old', pathname: '/d/old', search: '', lastVisited: 100 },
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
        { pathname: '/d/a', search: '?from=now-7d', lastVisited: T0 },
        { pathname: '/d/c', search: '', lastVisited: T0 },
      ])
    );

    const entries = await srv.getEntries();
    expect(entries).toEqual([
      { kind: 'dashboard', uid: 'b', pathname: '/d/b', search: '', lastVisited: T2 },
      { kind: 'dashboard', uid: 'a', pathname: '/d/a', search: '', lastVisited: T1 },
      { kind: 'dashboard', uid: 'c', pathname: '/d/c', search: '', lastVisited: T0 },
    ]);
    await jest.advanceTimersByTimeAsync(0);
    expect(setSpy).toHaveBeenCalledWith('org-1', JSON.stringify(stored(entries)));
  });

  it('stops recording and drops the pending write when stopped; returns nothing when never started', async () => {
    const setSpy = jest.spyOn(store, 'set');
    const srv = startAt('/d/abc');
    await srv.getEntries();
    locationService.push('/d/def');

    stop?.();
    locationService.push('/d/ghi');
    hideTab();
    await jest.advanceTimersByTimeAsync(2000);

    expect((await srv.getEntries()).map((e) => e.pathname)).toEqual(['/d/def', '/d/abc']);
    expect(setSpy.mock.calls.filter(([key]) => key === STORAGE_KEY)).toHaveLength(0);
    expect(await new PageHistorySrv().getEntries()).toEqual([]);
  });
});
