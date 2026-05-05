import { renderHook, waitFor } from '@testing-library/react';

import { ManagerKind } from 'app/features/apiserver/types';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

import { useFolderLeaderboard } from './useFolderLeaderboard';

jest.mock('app/features/search/service/searcher', () => ({
  getGrafanaSearcher: jest.fn(),
}));

jest.mock('app/features/search/service/utils', () => ({
  extractManagerKind: jest.fn((managedBy) => (typeof managedBy === 'string' ? managedBy : managedBy?.kind)),
  queryResultToViewItem: jest.fn((item) => ({
    uid: item.uid,
    title: item.name,
    url: item.url,
    managedBy: typeof item.managedBy === 'string' ? item.managedBy : item.managedBy?.kind,
  })),
}));

const mockGetGrafanaSearcher = getGrafanaSearcher as jest.MockedFunction<typeof getGrafanaSearcher>;

interface FakeFolder {
  uid: string;
  name: string;
  /**
   * Immediate parent folder UID, or empty for root. Mirrors the unified
   * searcher's `DashboardHit.folder`/`item.location` semantics — *not* a
   * slash-separated ancestor path, just the immediate parent.
   */
  location: string;
  managedBy?: string;
}

interface FakeDashboard {
  uid: string;
  name: string;
  url?: string;
  /** Immediate parent folder UID; same semantics as FakeFolder.location. */
  location: string;
  managedBy?: string;
}

interface MockArgs {
  folders: FakeFolder[];
  dashboards: FakeDashboard[];
  /**
   * Override the `totalRows` the searcher reports for the folder fetch. Used
   * to simulate a dataset larger than what the hook can fetch (so the
   * truncation check can fire without a 5,000-item fixture).
   */
  folderTotalRows?: number;
  /** Same idea, for the dashboard fetch. */
  dashboardTotalRows?: number;
}

function mockSearcherWith({ folders, dashboards, folderTotalRows, dashboardTotalRows }: MockArgs) {
  // The hook fires two `searcher.search` calls — one with `kind: ['folder']`,
  // one with `kind: ['dashboard']`. Branch on the kind so the mock returns the
  // right fixture for each.
  mockGetGrafanaSearcher.mockReturnValue({
    search: jest.fn(async (req: { kind?: string[] }) => {
      const kind = req?.kind?.[0];
      const isFolder = kind === 'folder';
      const rows: Array<FakeFolder | FakeDashboard> = isFolder ? folders : dashboards;
      const total = (isFolder ? folderTotalRows : dashboardTotalRows) ?? rows.length;
      return {
        view: {
          toArray: () => rows,
        },
        loadMoreItems: jest.fn(),
        isItemLoaded: () => true,
        totalRows: total,
      };
    }),
  } as unknown as ReturnType<typeof getGrafanaSearcher>);
}

describe('useFolderLeaderboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds folder rows with recursive dashboard counts', async () => {
    mockSearcherWith({
      folders: [
        { uid: 'parent', name: 'Parent', location: '' },
        { uid: 'child', name: 'Child', location: 'parent' },
      ],
      // d2's `location` is just `child`, not `parent/child`. The hook walks
      // the folder→parent map itself to find the full ancestor chain.
      dashboards: [
        { uid: 'd1', name: 'D1', url: '/d/d1', location: 'parent' },
        { uid: 'd2', name: 'D2', url: '/d/d2', location: 'child' },
      ],
    });

    const { result } = renderHook(() => useFolderLeaderboard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Parent's recursive count includes D2 which lives in the child folder.
    const parent = result.current.data.find((f) => f.uid === 'parent');
    expect(parent?.dashboardCount).toBe(2);
    expect(parent?.directDashboards).toHaveLength(1);
    expect(parent?.allDashboards).toHaveLength(2);

    // Child only sees its own dashboard.
    const child = result.current.data.find((f) => f.uid === 'child');
    expect(child?.dashboardCount).toBe(1);
  });

  it('rolls root-level dashboards into a synthetic General row', async () => {
    mockSearcherWith({
      folders: [{ uid: 'a', name: 'A', location: '' }],
      dashboards: [
        // Root dashboard — searcher returns the literal "general" UID.
        { uid: 'r1', name: 'Root one', url: '/d/r1', location: 'general' },
        { uid: 'r2', name: 'Root two', url: '/d/r2', location: '' },
        { uid: 'a1', name: 'In A', url: '/d/a1', location: 'a' },
      ],
    });

    const { result } = renderHook(() => useFolderLeaderboard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const general = result.current.data.find((f) => f.uid === 'general');
    expect(general).toBeDefined();
    expect(general?.dashboardCount).toBe(2);
    // Folder A's count should not include the root dashboards.
    const a = result.current.data.find((f) => f.uid === 'a');
    expect(a?.dashboardCount).toBe(1);
  });

  it('orders unmanaged folders first, then by dashboard count desc', async () => {
    mockSearcherWith({
      folders: [
        { uid: 'managed-big', name: 'Managed Big', location: '', managedBy: ManagerKind.Repo },
        { uid: 'unmanaged-small', name: 'Unmanaged Small', location: '' },
        { uid: 'unmanaged-big', name: 'Unmanaged Big', location: '' },
      ],
      dashboards: [
        { uid: 'd1', name: 'd1', url: '/d/1', location: 'managed-big' },
        { uid: 'd2', name: 'd2', url: '/d/2', location: 'managed-big' },
        { uid: 'd3', name: 'd3', url: '/d/3', location: 'managed-big' },
        { uid: 'd4', name: 'd4', url: '/d/4', location: 'unmanaged-small' },
        { uid: 'd5', name: 'd5', url: '/d/5', location: 'unmanaged-big' },
        { uid: 'd6', name: 'd6', url: '/d/6', location: 'unmanaged-big' },
      ],
    });

    const { result } = renderHook(() => useFolderLeaderboard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Two unmanaged folders ahead of the managed one; among the unmanaged the
    // bigger one comes first.
    const order = result.current.data.map((f) => f.uid);
    expect(order.indexOf('unmanaged-big')).toBeLessThan(order.indexOf('unmanaged-small'));
    expect(order.indexOf('unmanaged-small')).toBeLessThan(order.indexOf('managed-big'));
  });

  it('marks the synthetic General row as managed when every root dashboard agrees', async () => {
    mockSearcherWith({
      folders: [],
      dashboards: [
        { uid: 'r1', name: 'r1', url: '/d/r1', location: '', managedBy: ManagerKind.Repo },
        { uid: 'r2', name: 'r2', url: '/d/r2', location: '', managedBy: ManagerKind.Repo },
      ],
    });

    const { result } = renderHook(() => useFolderLeaderboard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const general = result.current.data.find((f) => f.uid === 'general');
    expect(general?.managedBy).toBe(ManagerKind.Repo);
  });

  it('leaves the General row unmanaged when only some root dashboards are managed', async () => {
    mockSearcherWith({
      folders: [],
      dashboards: [
        { uid: 'r1', name: 'r1', url: '/d/r1', location: '', managedBy: ManagerKind.Repo },
        { uid: 'r2', name: 'r2', url: '/d/r2', location: '' },
      ],
    });

    const { result } = renderHook(() => useFolderLeaderboard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const general = result.current.data.find((f) => f.uid === 'general');
    expect(general?.managedBy).toBeUndefined();
  });

  it('leaves the General row unmanaged when root dashboards are managed by different tools', async () => {
    // Mix of repo-managed + terraform-managed dashboards under the root: even
    // though every dashboard has *some* manager, they don't agree on which
    // one — the row stays unmanaged so the user can consolidate it.
    mockSearcherWith({
      folders: [],
      dashboards: [
        { uid: 'r1', name: 'r1', url: '/d/r1', location: '', managedBy: ManagerKind.Repo },
        { uid: 'r2', name: 'r2', url: '/d/r2', location: '', managedBy: ManagerKind.Terraform },
      ],
    });

    const { result } = renderHook(() => useFolderLeaderboard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const general = result.current.data.find((f) => f.uid === 'general');
    expect(general?.managedBy).toBeUndefined();
  });

  it('excludes already-managed dashboards from a folder’s migratable counts and lists', async () => {
    // The parent folder is unmanaged, but two of its descendants are already
    // managed by Git Sync. The page would push the folder's allDashboards
    // verbatim to the migrate API — including the managed ones triggers a
    // backend rejection, so the hook strips them here.
    mockSearcherWith({
      folders: [
        { uid: 'parent', name: 'Parent', location: '' },
        { uid: 'managed-sub', name: 'Managed sub', location: 'parent' },
      ],
      dashboards: [
        { uid: 'd1', name: 'D1', url: '/d/d1', location: 'parent' },
        // Two managed dashboards inside the parent's subtree.
        { uid: 'm1', name: 'M1', url: '/d/m1', location: 'parent', managedBy: ManagerKind.Repo },
        { uid: 'm2', name: 'M2', url: '/d/m2', location: 'managed-sub', managedBy: ManagerKind.Repo },
      ],
    });

    const { result } = renderHook(() => useFolderLeaderboard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const parent = result.current.data.find((f) => f.uid === 'parent');
    expect(parent?.dashboardCount).toBe(1);
    expect(parent?.directDashboards.map((d) => d.uid)).toEqual(['d1']);
    expect(parent?.allDashboards.map((d) => d.uid)).toEqual(['d1']);
  });

  it('does not flag truncation when the searcher returned every row', async () => {
    mockSearcherWith({
      folders: [{ uid: 'a', name: 'A', location: '' }],
      dashboards: [{ uid: 'd', name: 'd', url: '/d/d', location: 'a' }],
    });

    const { result } = renderHook(() => useFolderLeaderboard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isTruncated).toBe(false);
  });

  it('flags truncation when the searcher reports more rows than were fetched', async () => {
    // The fixture itself only has 1 folder and 1 dashboard, but the searcher
    // reports totalRows: 99999 — simulating an instance with way more rows
    // than the hook's MAX_PAGES * PAGE_SIZE cap.
    mockSearcherWith({
      folders: [{ uid: 'a', name: 'A', location: '' }],
      dashboards: [{ uid: 'd', name: 'd', url: '/d/d', location: 'a' }],
      folderTotalRows: 99999,
      dashboardTotalRows: 99999,
    });

    const { result } = renderHook(() => useFolderLeaderboard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isTruncated).toBe(true);
  });

  it('sets isError when the searcher rejects', async () => {
    mockGetGrafanaSearcher.mockReturnValue({
      search: jest.fn(async () => {
        throw new Error('boom');
      }),
    } as unknown as ReturnType<typeof getGrafanaSearcher>);

    const { result } = renderHook(() => useFolderLeaderboard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.data).toEqual([]);
  });
});
