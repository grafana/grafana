import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';

import { type DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { getCustomSearchHandler, searchRoute } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { ManagerKind } from 'app/features/apiserver/types';

import { setupProvisioningMswServer } from '../../mocks/server';

import { useFolderMigrationData } from './useFolderMigrationData';

setupProvisioningMswServer();

// The hook fans out to the unified searcher (folders + dashboards). Drive it
// through the real search endpoint with MSW; getCustomSearchHandler filters the
// supplied hits by the `type` query param, so one list serves both calls.
function mockSearch(hits: DashboardHit[]) {
  server.use(getCustomSearchHandler(hits));
}

function folder(name: string, parent = '', managedBy?: ManagerKind): DashboardHit {
  return {
    resource: 'folders',
    name,
    title: name,
    folder: parent,
    field: {},
    ...(managedBy ? { managedBy: { kind: managedBy } } : {}),
  };
}

function dashboard(name: string, parent = '', managedBy?: ManagerKind): DashboardHit {
  return {
    resource: 'dashboards',
    name,
    title: name,
    folder: parent,
    field: {},
    ...(managedBy ? { managedBy: { kind: managedBy } } : {}),
  };
}

describe('useFolderMigrationData', () => {
  it('builds folder rows with recursive dashboard counts', async () => {
    // d2 lives in `child`; the hook walks the folder→parent map so `parent`'s
    // recursive count picks it up even though the searcher only reports the
    // immediate parent.
    mockSearch([folder('parent'), folder('child', 'parent'), dashboard('d1', 'parent'), dashboard('d2', 'child')]);

    const { result } = renderHook(() => useFolderMigrationData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const parent = result.current.data.find((f) => f.uid === 'parent');
    expect(parent?.dashboardCount).toBe(2);
    expect(parent?.directDashboards).toHaveLength(1);
    expect(parent?.allDashboards).toHaveLength(2);

    const child = result.current.data.find((f) => f.uid === 'child');
    expect(child?.dashboardCount).toBe(1);
  });

  it('rolls root-level dashboards into a synthetic General row', async () => {
    mockSearch([
      folder('a'),
      // Root dashboards: the searcher reports either the literal "general" UID
      // or an empty folder.
      dashboard('r1', 'general'),
      dashboard('r2', ''),
      dashboard('a1', 'a'),
    ]);

    const { result } = renderHook(() => useFolderMigrationData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const general = result.current.data.find((f) => f.uid === 'general');
    expect(general).toBeDefined();
    expect(general?.dashboardCount).toBe(2);
    const a = result.current.data.find((f) => f.uid === 'a');
    expect(a?.dashboardCount).toBe(1);
  });

  it('orders unmanaged folders first, then by dashboard count desc', async () => {
    mockSearch([
      folder('managed-big', '', ManagerKind.Repo),
      folder('unmanaged-small'),
      folder('unmanaged-big'),
      dashboard('d1', 'managed-big'),
      dashboard('d2', 'managed-big'),
      dashboard('d3', 'managed-big'),
      dashboard('d4', 'unmanaged-small'),
      dashboard('d5', 'unmanaged-big'),
      dashboard('d6', 'unmanaged-big'),
    ]);

    const { result } = renderHook(() => useFolderMigrationData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const order = result.current.data.map((f) => f.uid);
    expect(order.indexOf('unmanaged-big')).toBeLessThan(order.indexOf('unmanaged-small'));
    expect(order.indexOf('unmanaged-small')).toBeLessThan(order.indexOf('managed-big'));
  });

  it('marks the synthetic General row as managed when every root dashboard agrees', async () => {
    mockSearch([dashboard('r1', '', ManagerKind.Repo), dashboard('r2', '', ManagerKind.Repo)]);

    const { result } = renderHook(() => useFolderMigrationData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const general = result.current.data.find((f) => f.uid === 'general');
    expect(general?.managedBy).toBe(ManagerKind.Repo);
  });

  it('leaves the General row unmanaged when only some root dashboards are managed', async () => {
    mockSearch([dashboard('r1', '', ManagerKind.Repo), dashboard('r2', '')]);

    const { result } = renderHook(() => useFolderMigrationData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const general = result.current.data.find((f) => f.uid === 'general');
    expect(general?.managedBy).toBeUndefined();
  });

  it('omits the General row when root dashboards are all managed by different tools', async () => {
    // Nothing unmanaged at the root and no single agreeing manager, so there's
    // nothing to migrate — don't surface a bogus unmanaged-looking target.
    mockSearch([dashboard('r1', '', ManagerKind.Repo), dashboard('r2', '', ManagerKind.Terraform)]);

    const { result } = renderHook(() => useFolderMigrationData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.find((f) => f.uid === 'general')).toBeUndefined();
  });

  it('excludes already-managed dashboards from a folder’s migratable counts and lists', async () => {
    // The parent is unmanaged but two descendants are already managed; cascading
    // the folder would otherwise push managed dashboards into the migrate job.
    mockSearch([
      folder('parent'),
      folder('managed-sub', 'parent'),
      dashboard('d1', 'parent'),
      dashboard('m1', 'parent', ManagerKind.Repo),
      dashboard('m2', 'managed-sub', ManagerKind.Repo),
    ]);

    const { result } = renderHook(() => useFolderMigrationData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const parent = result.current.data.find((f) => f.uid === 'parent');
    expect(parent?.dashboardCount).toBe(1);
    expect(parent?.directDashboards.map((d) => d.uid)).toEqual(['d1']);
    expect(parent?.allDashboards.map((d) => d.uid)).toEqual(['d1']);
  });

  it('pages through results that span more than one page', async () => {
    // 201 folders forces a second page (PAGE_SIZE is 200), exercising the
    // totalRows-driven parallel fetch.
    mockSearch(Array.from({ length: 201 }, (_, index) => folder(`f${index}`)));

    const { result } = renderHook(() => useFolderMigrationData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toHaveLength(201);
  });

  it('fails loudly instead of truncating when results exceed the page cap', async () => {
    // Report far more rows than the hook can page through; it should error
    // rather than return a silently truncated (incomplete) list.
    server.use(
      http.get(searchRoute, () =>
        HttpResponse.json({ totalHits: 999999, hits: [{ resource: 'folders', name: 'f', title: 'f', folder: '' }] })
      )
    );

    const { result } = renderHook(() => useFolderMigrationData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
  });

  it('sets isError when the search request fails', async () => {
    server.use(http.get(searchRoute, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));

    const { result } = renderHook(() => useFolderMigrationData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.data).toEqual([]);
  });
});
