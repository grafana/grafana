import { renderHook, waitFor } from '@testing-library/react';
import { of, throwError } from 'rxjs';

import { type NavModelItem } from '@grafana/data';

import { useEmptyDashboardNavItems, clearDashboardNavItemDataCache } from './useEmptyDashboardNavItems';

const getSnapshots = jest.fn();
const getLibraryPanels = jest.fn();
const search = jest.fn();
const fetch = jest.fn();

jest.mock('app/features/dashboard/services/SnapshotSrv', () => ({
  getDashboardSnapshotSrv: () => ({ getSnapshots }),
}));
jest.mock('app/features/library-panels/state/api', () => ({
  getLibraryPanels: (...args: unknown[]) => getLibraryPanels(...args),
}));
jest.mock('app/features/search/service/searcher', () => ({
  getGrafanaSearcher: () => ({ search }),
}));
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({ fetch }),
}));

const DASHBOARDS_LINK: NavModelItem = { text: 'Dashboards', id: 'dashboards/browse', url: '/dashboards' };

const allEmpty = () => {
  getSnapshots.mockResolvedValue([]);
  getLibraryPanels.mockResolvedValue({ totalCount: 0 });
  search.mockResolvedValue({ totalRows: 0 });
  fetch.mockReturnValue(of({ data: { totalCount: 0 } }));
};

const allWithData = () => {
  getSnapshots.mockResolvedValue([{ key: 'a' }]);
  getLibraryPanels.mockResolvedValue({ totalCount: 3 });
  search.mockResolvedValue({ totalRows: 2 });
  fetch.mockReturnValue(of({ data: { totalCount: 5 } }));
};

beforeEach(() => {
  jest.clearAllMocks();
  clearDashboardNavItemDataCache();
});

describe('useEmptyDashboardNavItems', () => {
  it('returns an empty set and fetches nothing for a non-dashboards link', () => {
    allEmpty();
    const link: NavModelItem = { text: 'Admin', id: 'cfg', url: '/admin' };
    const { result } = renderHook(() => useEmptyDashboardNavItems(link, true));
    expect(result.current.size).toBe(0);
    expect(getSnapshots).not.toHaveBeenCalled();
    expect(getLibraryPanels).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches nothing while the dashboards section is collapsed', () => {
    allEmpty();
    renderHook(() => useEmptyDashboardNavItems(DASHBOARDS_LINK, false));
    expect(getSnapshots).not.toHaveBeenCalled();
    expect(getLibraryPanels).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('hides all four items when every source is empty', async () => {
    allEmpty();
    const { result } = renderHook(() => useEmptyDashboardNavItems(DASHBOARDS_LINK, true));
    await waitFor(() => expect(result.current.size).toBe(4));
    expect(result.current.has('dashboards/snapshots')).toBe(true);
    expect(result.current.has('dashboards/library-panels')).toBe(true);
    expect(result.current.has('dashboards/public')).toBe(true);
    expect(result.current.has('dashboards/recently-deleted')).toBe(true);
  });

  it('hides nothing when every source has data', async () => {
    allWithData();
    const { result } = renderHook(() => useEmptyDashboardNavItems(DASHBOARDS_LINK, true));
    // All four items are hidden during the initial loading state.
    expect(result.current.size).toBe(4);
    // Once resolved, nothing is hidden because all sources have data.
    await waitFor(() => expect(result.current.size).toBe(0));
  });

  it('shows (does not hide) an item whose check errors', async () => {
    allEmpty();
    getSnapshots.mockRejectedValue(new Error('boom'));
    fetch.mockReturnValue(throwError(() => new Error('boom')));
    const { result } = renderHook(() => useEmptyDashboardNavItems(DASHBOARDS_LINK, true));
    await waitFor(() => expect(result.current.size).toBe(2));
    expect(result.current.has('dashboards/snapshots')).toBe(false);
    expect(result.current.has('dashboards/public')).toBe(false);
    expect(result.current.has('dashboards/library-panels')).toBe(true);
    expect(result.current.has('dashboards/recently-deleted')).toBe(true);
  });

  it('session cache prevents refetching on remount', async () => {
    allEmpty();
    // First mount: let all four sources resolve and populate the resultCache.
    const { result: result1 } = renderHook(() => useEmptyDashboardNavItems(DASHBOARDS_LINK, true));
    await waitFor(() => expect(result1.current.size).toBe(4));

    // Each source should have been called exactly once so far.
    expect(getSnapshots).toHaveBeenCalledTimes(1);
    expect(getLibraryPanels).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);

    // Second mount WITHOUT clearing the cache — the resultCache should short-circuit all fetches.
    const { result: result2 } = renderHook(() => useEmptyDashboardNavItems(DASHBOARDS_LINK, true));
    await waitFor(() => expect(result2.current.size).toBe(4));

    // None of the sources should have been called a second time.
    expect(getSnapshots).toHaveBeenCalledTimes(1);
    expect(getLibraryPanels).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
