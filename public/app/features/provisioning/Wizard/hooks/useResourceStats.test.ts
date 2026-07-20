import { renderHook } from '@testing-library/react';

import {
  type GetRepositoryFilesApiResponse,
  type GetResourceStatsApiResponse,
  useGetRepositoryFilesQuery,
  useGetResourceStatsQuery,
} from 'app/api/clients/provisioning/v0alpha1';

import { useResourceStats } from './useResourceStats';

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetRepositoryFilesQuery: jest.fn(),
  useGetResourceStatsQuery: jest.fn(),
}));

const mockUseGetResourceStatsQuery = useGetResourceStatsQuery as jest.MockedFunction<typeof useGetResourceStatsQuery>;
const mockUseGetRepositoryFilesQuery = useGetRepositoryFilesQuery as jest.MockedFunction<
  typeof useGetRepositoryFilesQuery
>;

function mockStats(data?: GetResourceStatsApiResponse, isFetching = false) {
  // The hook only reads `data` and `isFetching`; the rest satisfies the query result shape.
  mockUseGetResourceStatsQuery.mockReturnValue({ data, isFetching, refetch: jest.fn() } as ReturnType<
    typeof useGetResourceStatsQuery
  >);
}

function mockFiles(data?: GetRepositoryFilesApiResponse, isFetching = false) {
  mockUseGetRepositoryFilesQuery.mockReturnValue({ data, isFetching, refetch: jest.fn() } as ReturnType<
    typeof useGetRepositoryFilesQuery
  >);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStats(undefined);
  mockFiles(undefined);
});

describe('useResourceStats', () => {
  it('reports empty counts when there are no resources or files', () => {
    const { result } = renderHook(() => useResourceStats('repo', 'folder', false, { isHealthy: true }));

    expect(result.current.resourceCount).toBe(0);
    expect(result.current.resourceCountString).toBe('Empty');
    expect(result.current.fileCount).toBe(0);
    expect(result.current.fileCountString).toBe('Empty');
    expect(result.current.managedCount).toBe(0);
    expect(result.current.unmanagedCount).toBe(0);
  });

  it('sums instance stats for known kinds and renders a generic total', () => {
    mockStats({
      instance: [
        { group: 'dashboard.grafana.app', resource: 'dashboards', count: 3 },
        { group: 'folders', resource: 'folders', count: 2 },
        // Unknown kind is ignored so the total only reflects kinds the UI knows about.
        { group: 'secret.grafana.app', resource: 'secrets', count: 9 },
      ],
    });

    const { result } = renderHook(() => useResourceStats('repo', 'instance', false, { isHealthy: true }));

    expect(result.current.resourceCount).toBe(5);
    expect(result.current.resourceCountString).toBe('5 resources');
  });

  it('uses the singular label for a single resource', () => {
    mockStats({ instance: [{ group: 'dashboards', resource: 'dashboards', count: 1 }] });

    const { result } = renderHook(() => useResourceStats('repo', 'instance', false, { isHealthy: true }));

    expect(result.current.resourceCountString).toBe('1 resource');
  });

  it('counts non-repo managed stats as unmanaged and repo-managed stats as managed', () => {
    mockStats({
      managed: [
        { kind: 'repo', stats: [{ group: 'dashboards', resource: 'dashboards', count: 4 }] },
        { kind: 'terraform', stats: [{ group: 'folders', resource: 'folders', count: 6 }] },
      ],
    });

    const { result } = renderHook(() => useResourceStats('repo', 'folder', false, { isHealthy: true }));

    expect(result.current.managedCount).toBe(4);
    expect(result.current.unmanagedCount).toBe(6);
  });

  it('counts only json/yaml files and renders the file label', () => {
    mockFiles({
      items: [{ path: 'a.json' }, { path: 'b.yaml' }, { path: 'c.png' }, { path: undefined }],
    });

    const { result } = renderHook(() => useResourceStats('repo', 'folder', false, { isHealthy: true }));

    expect(result.current.fileCount).toBe(2);
    expect(result.current.fileCountString).toBe('2 files');
  });

  it('flags loading while either query is fetching or reconciliation is pending', () => {
    mockStats(undefined, true);
    const fetching = renderHook(() => useResourceStats('repo', 'folder', false, { isHealthy: true }));
    expect(fetching.result.current.isLoading).toBe(true);

    mockStats(undefined, false);
    const pending = renderHook(() => useResourceStats('repo', 'folder', false, { healthStatusNotReady: true }));
    expect(pending.result.current.isLoading).toBe(true);
  });

  describe('migration and skip logic', () => {
    it('requires migration for instance sync whenever resources exist', () => {
      mockStats({ instance: [{ group: 'dashboards', resource: 'dashboards', count: 2 }] });

      const { result } = renderHook(() => useResourceStats('repo', 'instance', false, { isHealthy: true }));

      expect(result.current.requiresMigration).toBe(true);
      expect(result.current.shouldSkipSync).toBe(false);
    });

    it('only migrates folder sync when the user opts in', () => {
      mockStats({ instance: [{ group: 'dashboards', resource: 'dashboards', count: 2 }] });

      const optIn = renderHook(() => useResourceStats('repo', 'folder', true, { isHealthy: true }));
      expect(optIn.result.current.requiresMigration).toBe(true);

      const optOut = renderHook(() => useResourceStats('repo', 'folder', false, { isHealthy: true }));
      expect(optOut.result.current.requiresMigration).toBe(false);
    });

    it('skips sync when a folder target has no resources and no files', () => {
      const { result } = renderHook(() => useResourceStats('repo', 'folder', false, { isHealthy: true }));

      expect(result.current.shouldSkipSync).toBe(true);
    });
  });
});
