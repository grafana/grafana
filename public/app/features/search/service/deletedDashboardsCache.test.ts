import { deletedDashboardsCache } from './deletedDashboardsCache';

const mockListDeletedDashboards = jest.fn();

jest.mock('app/features/dashboard/api/dashboard_api', () => ({
  getDashboardAPI: () =>
    Promise.resolve({
      listDeletedDashboards: mockListDeletedDashboards,
    }),
}));

describe('DeletedDashboardsCache', () => {
  beforeEach(() => {
    deletedDashboardsCache.clear();
    jest.clearAllMocks();
  });

  it('should sort items by deletionTimestamp descending', async () => {
    mockListDeletedDashboards.mockResolvedValue({
      apiVersion: 'v1',
      kind: 'DashboardList',
      metadata: { resourceVersion: '1' },
      items: [
        createDeletedDashboard('a', '2024-01-01T00:00:00Z'),
        createDeletedDashboard('c', '2024-03-01T00:00:00Z'),
        createDeletedDashboard('b', '2024-02-01T00:00:00Z'),
      ],
    });

    const result = await deletedDashboardsCache.getAsResourceList();
    expect(result.items.map((i) => i.metadata.name)).toEqual(['c', 'b', 'a']);
  });

  it('should put items without deletionTimestamp at the end', async () => {
    mockListDeletedDashboards.mockResolvedValue({
      apiVersion: 'v1',
      kind: 'DashboardList',
      metadata: { resourceVersion: '1' },
      items: [
        createDeletedDashboard('no-ts', undefined),
        createDeletedDashboard('recent', '2024-03-01T00:00:00Z'),
        createDeletedDashboard('old', '2024-01-01T00:00:00Z'),
      ],
    });

    const result = await deletedDashboardsCache.getAsResourceList();
    expect(result.items.map((i) => i.metadata.name)).toEqual(['recent', 'old', 'no-ts']);
  });

  it('should return cached results on subsequent calls', async () => {
    mockListDeletedDashboards.mockResolvedValue({
      apiVersion: 'v1',
      kind: 'DashboardList',
      metadata: { resourceVersion: '1' },
      items: [createDeletedDashboard('a', '2024-01-01T00:00:00Z')],
    });

    await deletedDashboardsCache.getAsResourceList();
    await deletedDashboardsCache.getAsResourceList();

    expect(mockListDeletedDashboards).toHaveBeenCalledTimes(1);
  });
});

function createDeletedDashboard(name: string, deletionTimestamp: string | undefined) {
  return {
    apiVersion: 'v1',
    kind: 'Dashboard',
    metadata: {
      name,
      resourceVersion: '1',
      creationTimestamp: '2024-01-01T00:00:00Z',
      ...(deletionTimestamp ? { deletionTimestamp } : {}),
    },
    spec: { title: name, schemaVersion: 1 },
  };
}
