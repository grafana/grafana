import { renderHook, waitFor } from '@testing-library/react';

import { ManagerKind } from 'app/features/apiserver/types';
import { listFolders } from 'app/features/browse-dashboards/api/services';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

import { useFolderLeaderboard } from './useFolderLeaderboard';

jest.mock('app/features/browse-dashboards/api/services', () => ({
  listFolders: jest.fn(),
}));

jest.mock('app/features/search/service/searcher', () => ({
  getGrafanaSearcher: jest.fn(),
}));

jest.mock('app/features/search/service/utils', () => ({
  queryResultToViewItem: jest.fn((item) => ({
    uid: item.uid,
    title: item.name,
    url: item.url,
    managedBy: typeof item.managedBy === 'string' ? item.managedBy : item.managedBy?.kind,
  })),
}));

const mockListFolders = listFolders as jest.MockedFunction<typeof listFolders>;
const mockGetGrafanaSearcher = getGrafanaSearcher as jest.MockedFunction<typeof getGrafanaSearcher>;

interface FakeDashboard {
  uid: string;
  name: string;
  url?: string;
  location: string;
  managedBy?: string;
}

function mockSearcherWith(dashboards: FakeDashboard[]) {
  mockGetGrafanaSearcher.mockReturnValue({
    search: jest.fn(async () => ({
      view: {
        toArray: () => dashboards,
        // Other QueryResponse fields aren't used by the hook.
      },
      loadMoreItems: jest.fn(),
      isItemLoaded: () => true,
      totalRows: dashboards.length,
    })),
    // Other GrafanaSearcher fields aren't used by the hook.
  } as unknown as ReturnType<typeof getGrafanaSearcher>);
}

describe('useFolderLeaderboard', () => {
  beforeEach(() => {
    // clearAllMocks (just call history) so the inline jest.mock factory
    // implementations (e.g. queryResultToViewItem) are preserved across tests.
    // Each test sets its own listFolders / searcher mock with mockResolvedValue
    // so a single return covers every call the hook may make.
    jest.clearAllMocks();
    mockListFolders.mockResolvedValue([]);
  });

  it('builds folder rows with recursive dashboard counts', async () => {
    mockListFolders.mockResolvedValue([
      { kind: 'folder', uid: 'parent', title: 'Parent' },
      { kind: 'folder', uid: 'child', title: 'Child' },
    ]);
    mockSearcherWith([
      { uid: 'd1', name: 'D1', url: '/d/d1', location: 'parent' },
      { uid: 'd2', name: 'D2', url: '/d/d2', location: 'parent/child' },
    ]);

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
    mockListFolders.mockResolvedValue([{ kind: 'folder', uid: 'a', title: 'A' }]);
    mockSearcherWith([
      // Root dashboard — searcher returns the literal "general" UID.
      { uid: 'r1', name: 'Root one', url: '/d/r1', location: 'general' },
      { uid: 'r2', name: 'Root two', url: '/d/r2', location: '' },
      { uid: 'a1', name: 'In A', url: '/d/a1', location: 'a' },
    ]);

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
    mockListFolders.mockResolvedValue([
      { kind: 'folder', uid: 'managed-big', title: 'Managed Big', managedBy: ManagerKind.Repo },
      { kind: 'folder', uid: 'unmanaged-small', title: 'Unmanaged Small' },
      { kind: 'folder', uid: 'unmanaged-big', title: 'Unmanaged Big' },
    ]);
    mockSearcherWith([
      { uid: 'd1', name: 'd1', url: '/d/1', location: 'managed-big' },
      { uid: 'd2', name: 'd2', url: '/d/2', location: 'managed-big' },
      { uid: 'd3', name: 'd3', url: '/d/3', location: 'managed-big' },
      { uid: 'd4', name: 'd4', url: '/d/4', location: 'unmanaged-small' },
      { uid: 'd5', name: 'd5', url: '/d/5', location: 'unmanaged-big' },
      { uid: 'd6', name: 'd6', url: '/d/6', location: 'unmanaged-big' },
    ]);

    const { result } = renderHook(() => useFolderLeaderboard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Two unmanaged folders ahead of the managed one; among the unmanaged,
    // the bigger one comes first. The synthetic General row also appears
    // when the listFolders payload has folders without a parent (their
    // implicit parent is the General root) — assert the relative order of
    // the three real folders and the General row.
    const order = result.current.data.map((f) => f.uid);
    expect(order.indexOf('unmanaged-big')).toBeLessThan(order.indexOf('unmanaged-small'));
    expect(order.indexOf('unmanaged-small')).toBeLessThan(order.indexOf('managed-big'));
  });

  it('sets isError when the underlying calls reject', async () => {
    mockListFolders.mockRejectedValueOnce(new Error('boom'));
    mockSearcherWith([]);

    const { result } = renderHook(() => useFolderLeaderboard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.data).toEqual([]);
  });
});
