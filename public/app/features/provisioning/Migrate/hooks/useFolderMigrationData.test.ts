import { act, renderHook, waitFor } from '@testing-library/react';
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

function folder(name: string, parent = ''): DashboardHit {
  return { resource: 'folders', name, title: name, folder: parent, field: {} };
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
  it('lists each folder with the unmanaged dashboards directly inside it (not recursively)', async () => {
    // d1 is directly in `parent`; d2 is in the nested `child`. Migration isn't
    // recursive, so `parent` covers only d1 and `child` gets its own row for d2.
    mockSearch([folder('parent'), folder('child', 'parent'), dashboard('d1', 'parent'), dashboard('d2', 'child')]);

    const { result } = renderHook(() => useFolderMigrationData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const parent = result.current.data.find((f) => f.uid === 'parent');
    expect(parent?.dashboardCount).toBe(1);
    expect(parent?.directDashboards.map((d) => d.uid)).toEqual(['d1']);

    const child = result.current.data.find((f) => f.uid === 'child');
    expect(child?.dashboardCount).toBe(1);
    expect(child?.directDashboards.map((d) => d.uid)).toEqual(['d2']);
  });

  it('hides folders with no unmanaged dashboards directly inside them', async () => {
    // `empty` has nothing; `only-subfolders` holds a child folder but no direct
    // dashboards. Neither has anything to migrate, so neither appears.
    mockSearch([
      folder('empty'),
      folder('only-subfolders'),
      folder('child', 'only-subfolders'),
      folder('has-dashboards'),
      dashboard('d1', 'has-dashboards'),
    ]);

    const { result } = renderHook(() => useFolderMigrationData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.map((f) => f.uid)).toEqual(['has-dashboards']);
  });

  it('rolls root-level dashboards into a synthetic General row', async () => {
    mockSearch([
      folder('a'),
      // Root dashboards: the searcher reports the literal "general" UID, an empty
      // folder, or no folder field at all.
      dashboard('r1', 'general'),
      dashboard('r2', ''),
      { resource: 'dashboards', name: 'r3', title: 'r3', field: {} },
      dashboard('a1', 'a'),
    ]);

    const { result } = renderHook(() => useFolderMigrationData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const general = result.current.data.find((f) => f.uid === 'general');
    expect(general?.dashboardCount).toBe(3);
    expect(result.current.data.find((f) => f.uid === 'a')?.dashboardCount).toBe(1);
  });

  it('falls back to the folder UID as the title when the folder is missing from the list', async () => {
    // A dashboard whose parent folder didn't come back from the folder search
    // still gets a row; with no folder title to use, the title falls back to
    // the UID. (The searcher routes unknown parents to a "shared with me" UID.)
    mockSearch([dashboard('d1', 'ghost')]);

    const { result } = renderHook(() => useFolderMigrationData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toHaveLength(1);
    const row = result.current.data[0];
    expect(row.dashboardCount).toBe(1);
    expect(row.title).toBe(row.uid);
  });

  it('excludes already-managed dashboards', async () => {
    // `parent` has one unmanaged and one managed dashboard; only the unmanaged
    // one counts. `managed-only` has nothing migratable, so it doesn't appear.
    mockSearch([
      folder('parent'),
      folder('managed-only'),
      dashboard('d1', 'parent'),
      dashboard('m1', 'parent', ManagerKind.Repo),
      dashboard('m2', 'managed-only', ManagerKind.Repo),
    ]);

    const { result } = renderHook(() => useFolderMigrationData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.map((f) => f.uid)).toEqual(['parent']);
    const parent = result.current.data.find((f) => f.uid === 'parent');
    expect(parent?.directDashboards.map((d) => d.uid)).toEqual(['d1']);
  });

  it('orders folders by dashboard count descending, then title', async () => {
    mockSearch([
      folder('small'),
      folder('big'),
      dashboard('d1', 'small'),
      dashboard('d2', 'big'),
      dashboard('d3', 'big'),
    ]);

    const { result } = renderHook(() => useFolderMigrationData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.map((f) => f.uid)).toEqual(['big', 'small']);
  });

  it('pages through results that span more than one page', async () => {
    // 201 dashboards forces a second page (PAGE_SIZE is 200), exercising the
    // totalRows-driven parallel fetch.
    mockSearch([folder('f'), ...Array.from({ length: 201 }, (_, index) => dashboard(`d${index}`, 'f'))]);

    const { result } = renderHook(() => useFolderMigrationData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.find((f) => f.uid === 'f')?.dashboardCount).toBe(201);
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

  it('reloads the data when refetch is called', async () => {
    mockSearch([folder('a'), dashboard('d1', 'a')]);

    const { result } = renderHook(() => useFolderMigrationData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(1);

    // A second dashboard appears in a new folder; refetch picks it up.
    mockSearch([folder('a'), dashboard('d1', 'a'), folder('b'), dashboard('d2', 'b')]);
    act(() => result.current.refetch());

    await waitFor(() => expect(result.current.data).toHaveLength(2));
  });

  it('sets isError when the search request fails', async () => {
    server.use(http.get(searchRoute, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));

    const { result } = renderHook(() => useFolderMigrationData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.data).toEqual([]);
  });
});
