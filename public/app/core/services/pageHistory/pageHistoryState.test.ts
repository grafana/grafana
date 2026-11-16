import {
  clearHistory,
  EMPTY_HISTORY,
  type HistoryState,
  mergeStored,
  PAGE_HISTORY_MAX_ENTRY_CHARS,
  PAGE_HISTORY_MAX_PER_KIND,
  recordTitle,
  recordVisit,
} from './pageHistoryState';
import { type PageHistoryEntry, type PageIdentity } from './types';

const T0 = 1_700_000_000_000;
const T1 = T0 + 60_000;
const T2 = T0 + 120_000;

const dashA: PageIdentity = { kind: 'dashboard', uid: 'a', pathname: '/d/a' };
const alertList: PageIdentity = { kind: 'alerting', pathname: '/alerting/list' };
const alertSilences: PageIdentity = { kind: 'alerting', pathname: '/alerting/silences' };

/** A state holding exactly these rows, never cleared, with `latest` at the newest stamp. */
function holding(...entries: PageHistoryEntry[]): HistoryState {
  return { entries, clearedAt: 0, latest: Math.max(0, ...entries.map((e) => e.lastVisited ?? 0)) };
}

describe('recordVisit', () => {
  it('adds a row at the top, stamped with the wall clock', () => {
    expect(recordVisit(EMPTY_HISTORY, dashA, '?from=now-1h', T0, false)).toEqual({
      entries: [{ kind: 'dashboard', uid: 'a', pathname: '/d/a', search: '?from=now-1h', lastVisited: T0 }],
      clearedAt: 0,
      latest: T0,
    });
  });

  it('refreshes the search of a revisited page and moves it to the top instead of adding a row', () => {
    let state = recordVisit(EMPTY_HISTORY, dashA, '?from=now-1h', T0, false);
    state = recordVisit(state, alertList, '', T1, false);
    state = recordVisit(state, dashA, '?from=now-6h', T2, false);

    expect(state.entries).toEqual([
      { kind: 'dashboard', uid: 'a', pathname: '/d/a', search: '?from=now-6h', lastVisited: T2 },
      { kind: 'alerting', pathname: '/alerting/list', search: '', lastVisited: T1 },
    ]);
  });

  it('stamps past the previous stamp within one millisecond, so the latest event is first', () => {
    const state = recordVisit(recordVisit(EMPTY_HISTORY, alertList, '', T0, false), alertSilences, '', T0, false);

    expect(state.entries.map((e) => [e.pathname, e.lastVisited])).toEqual([
      ['/alerting/silences', T0 + 1],
      ['/alerting/list', T0],
    ]);
    expect(state.latest).toBe(T0 + 1);
  });

  it('keeps the title of a revisited page until its page sets its nav again', () => {
    const titled = recordTitle(recordVisit(EMPTY_HISTORY, alertList, '', T0, false), alertList, 'Alert rules', T0);

    expect(recordVisit(titled, alertList, '?search=x', T1, false).entries).toEqual([
      { kind: 'alerting', pathname: '/alerting/list', search: '?search=x', lastVisited: T1, title: 'Alert rules' },
    ]);
  });

  it('lets a rewrite refresh the row of the page the user is on, but never add one', () => {
    const dashASlug: PageIdentity = { kind: 'dashboard', uid: 'a', pathname: '/d/a/slug' };
    expect(recordVisit(EMPTY_HISTORY, dashASlug, '', T0, true)).toBe(EMPTY_HISTORY);

    const visited = recordVisit(EMPTY_HISTORY, dashA, '?from=now-6h', T0, false);
    expect(recordVisit(visited, dashASlug, '?from=now-6h', T1, true).entries).toEqual([
      { kind: 'dashboard', uid: 'a', pathname: '/d/a/slug', search: '?from=now-6h', lastVisited: T1 },
    ]);
  });

  it('keeps the newest rows per kind, so a burst of one kind never evicts another', () => {
    let state = recordVisit(EMPTY_HISTORY, alertList, '', T0, false);
    for (let i = 0; i <= PAGE_HISTORY_MAX_PER_KIND; i++) {
      state = recordVisit(state, { kind: 'dashboard', uid: `${i}`, pathname: `/d/${i}` }, '', T0, false);
    }

    expect(state.entries.map((e) => e.pathname)).toEqual([
      ...Array.from({ length: PAGE_HISTORY_MAX_PER_KIND }, (_, i) => `/d/${PAGE_HISTORY_MAX_PER_KIND - i}`),
      '/alerting/list',
    ]);
  });

  it("does not record a URL too large to store and leaves the page's earlier row as it was", () => {
    const before = recordVisit(EMPTY_HISTORY, dashA, '?from=now-1h', T0, false);
    const oversized = `?q=${'x'.repeat(PAGE_HISTORY_MAX_ENTRY_CHARS)}`;

    expect(recordVisit(before, dashA, oversized, T1, false)).toBe(before);
    expect(recordVisit(before, alertList, oversized, T1, false)).toBe(before);
  });
});

describe('recordTitle', () => {
  it('titles the row of the page as a new revision, so the stamp moves past the visit', () => {
    const state = recordTitle(recordVisit(EMPTY_HISTORY, alertList, '', T0, false), alertList, 'Alert rules', T0);

    expect(state).toEqual({
      entries: [
        { kind: 'alerting', pathname: '/alerting/list', search: '', lastVisited: T0 + 1, title: 'Alert rules' },
      ],
      clearedAt: 0,
      latest: T0 + 1,
    });
  });

  it('replaces the title a page set earlier', () => {
    const loading = recordTitle(recordVisit(EMPTY_HISTORY, alertList, '', T0, false), alertList, 'Loading rule', T0);

    expect(recordTitle(loading, alertList, 'High CPU', T1).entries).toEqual([
      { kind: 'alerting', pathname: '/alerting/list', search: '', lastVisited: T1, title: 'High CPU' },
    ]);
  });

  it('changes nothing for a page without a row, or whose row already carries the title', () => {
    const titled = recordTitle(recordVisit(EMPTY_HISTORY, alertList, '', T0, false), alertList, 'Alert rules', T0);

    expect(recordTitle(titled, alertList, 'Alert rules', T1)).toBe(titled);
    expect(recordTitle(titled, dashA, 'Prod', T1)).toBe(titled);
  });

  it('drops a title that would push the row over the size cap and keeps the URL', () => {
    const base = JSON.stringify({ pathname: '/alerting/list', search: '?q=', lastVisited: T0 }).length;
    const search = `?q=${'x'.repeat(PAGE_HISTORY_MAX_ENTRY_CHARS - base)}`; // the row sits exactly at the cap
    const state = recordVisit(EMPTY_HISTORY, alertList, search, T0, false);
    expect(state.entries[0].search).toBe(search);

    expect(recordTitle(state, alertList, 'Alert rules', T1)).toBe(state);
  });
});

describe('mergeStored', () => {
  const rowA = { kind: 'dashboard', uid: 'a', pathname: '/d/a', search: '', lastVisited: T1 } as const;
  const rowList = { kind: 'alerting', pathname: '/alerting/list', search: '', lastVisited: T0 } as const;

  it('adds the stored rows newest first and keeps the later revision of a page held by both', () => {
    const stored = {
      clearedAt: 0,
      entries: [
        { ...rowA, search: '?from=now-7d', lastVisited: T0 },
        { kind: 'dashboard' as const, uid: 'c', pathname: '/d/c', search: '', lastVisited: T2 },
      ],
    };

    expect(mergeStored(holding(rowA, rowList), stored)).toEqual({
      entries: [{ kind: 'dashboard', uid: 'c', pathname: '/d/c', search: '', lastVisited: T2 }, rowA, rowList],
      clearedAt: 0,
      latest: T2,
    });
  });

  it('takes the stored revision of a page when it is the later one', () => {
    const titledLater = { ...rowList, title: 'Alert rules', lastVisited: T0 + 1 };

    expect(mergeStored(holding(rowList), { clearedAt: 0, entries: [titledLater] }).entries).toEqual([titledLater]);
  });

  it('keeps its own row on an exact tie', () => {
    const state = holding({ ...rowA, search: '?from=now-1h' });

    expect(mergeStored(state, { clearedAt: 0, entries: [{ ...rowA, search: '?from=now-7d' }] }).entries).toEqual(
      state.entries
    );
  });

  it('is idempotent, so a retried write merges the same copy without effect', () => {
    const stored = { clearedAt: T0, entries: [{ ...rowList, lastVisited: T1 }] };
    const once = mergeStored(holding(rowA), stored);

    expect(mergeStored(once, stored)).toEqual(once);
  });

  it('adopts a stored clear and drops the rows at or before it', () => {
    const state = holding({ ...rowList, lastVisited: T1 + 1 }, rowA);

    expect(mergeStored(state, { clearedAt: T1, entries: [] })).toEqual({
      entries: [{ ...rowList, lastVisited: T1 + 1 }],
      clearedAt: T1,
      latest: T1 + 1,
    });
  });

  it('keeps rows without a time (seeded) last, and only while nothing was ever cleared', () => {
    const seeded = { kind: 'dashboard', uid: 's', pathname: '/d/s', search: '' } as const;

    expect(mergeStored(holding(seeded), { clearedAt: 0, entries: [rowList] }).entries).toEqual([rowList, seeded]);
    expect(mergeStored(holding(seeded), { clearedAt: T0, entries: [] }).entries).toEqual([]);
  });

  it('caps per kind after merging, evicting the oldest', () => {
    const stored = Array.from({ length: PAGE_HISTORY_MAX_PER_KIND }, (_, i) => ({
      kind: 'dashboard' as const,
      uid: `s${i}`,
      pathname: `/d/s${i}`,
      search: '',
      lastVisited: T0 - i,
    }));

    const merged = mergeStored(holding(rowA), { clearedAt: 0, entries: stored });

    expect(merged.entries).toHaveLength(PAGE_HISTORY_MAX_PER_KIND);
    expect(merged.entries[0]).toEqual(rowA);
    expect(merged.entries.map((e) => e.pathname)).not.toContain(`/d/s${PAGE_HISTORY_MAX_PER_KIND - 1}`);
  });
});

describe('clearHistory', () => {
  const ahead = { kind: 'dashboard', uid: 'ahead', pathname: '/d/ahead', search: '', lastVisited: T2 } as const;

  it('forgets every row, stamped past the rows it has seen from a device whose clock is ahead', () => {
    const seen = mergeStored(EMPTY_HISTORY, { clearedAt: 0, entries: [ahead] });

    const cleared = clearHistory(seen, T0); // this clock reads T0, before the row's stamp
    expect(cleared).toEqual({ entries: [], clearedAt: T2 + 1, latest: T2 + 1 });
    // The stored copy of that row does not come back on the next sync.
    expect(mergeStored(cleared, { clearedAt: 0, entries: [ahead] })).toEqual(cleared);
  });

  it('clears past a stored clear from a device whose clock is ahead', () => {
    const state = mergeStored(EMPTY_HISTORY, { clearedAt: T1, entries: [{ ...ahead, lastVisited: T1 + 1 }] });

    expect(clearHistory(state, T0).clearedAt).toBe(T1 + 2);
  });

  it('records visits past a clear from a device whose clock is ahead, so they survive the next sync', () => {
    const cleared = mergeStored(EMPTY_HISTORY, { clearedAt: T1, entries: [] }); // seen while this clock reads T0

    const visited = recordVisit(cleared, dashA, '', T0, false);
    expect(visited.entries).toEqual([
      { kind: 'dashboard', uid: 'a', pathname: '/d/a', search: '', lastVisited: T1 + 1 },
    ]);
    expect(mergeStored(visited, { clearedAt: T1, entries: [] }).entries).toEqual(visited.entries);
  });
});
