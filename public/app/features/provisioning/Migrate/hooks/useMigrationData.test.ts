import { HttpResponse, http } from 'msw';
import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type ResourceListItem } from 'app/api/clients/provisioning/v0alpha1';

import { setupProvisioningMswServer } from '../../mocks/server';

import { useMigrationData } from './useMigrationData';

setupProvisioningMswServer();

const NAMESPACE_RESOURCES_ROUTE = `${BASE}/resources`;

let wrapper: ReturnType<typeof getWrapper>;
beforeEach(() => {
  wrapper = getWrapper({});
});

function folder(name: string, parent = ''): ResourceListItem {
  return { group: 'folder.grafana.app', resource: 'folders', name, title: name, folder: parent, path: '', hash: '' };
}

function dashboard(name: string, parent = ''): ResourceListItem {
  return {
    group: 'dashboard.grafana.app',
    resource: 'dashboards',
    name,
    title: name,
    folder: parent,
    path: '',
    hash: '',
  };
}

function playlist(name: string, title = name): ResourceListItem {
  return { group: 'playlist.grafana.app', resource: 'playlists', name, title, path: '', hash: '' };
}

/**
 * Serves the two calls the hook makes against one fixture set: the folder listing (filtered by
 * group/resource) and the unmanaged rows. `managed=false` is the server's job, so anything a test
 * wants excluded simply isn't in `items`.
 */
function mockNamespaceResources(items: ResourceListItem[]) {
  server.use(
    http.get(NAMESPACE_RESOURCES_ROUTE, ({ request }) => {
      const params = new URL(request.url).searchParams;
      const resource = params.get('resource');
      return HttpResponse.json({
        items: resource ? items.filter((item) => item.resource === resource) : items,
        metadata: {},
      });
    })
  );
}

describe('useMigrationData (folder-scoped kinds)', () => {
  it('nests unmanaged dashboards under the folder directly containing them (not recursively)', async () => {
    mockNamespaceResources([
      folder('parent'),
      folder('child', 'parent'),
      dashboard('d1', 'parent'),
      dashboard('d2', 'child'),
    ]);

    const { result } = renderHook(() => useMigrationData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.find((f) => f.uid === 'parent')?.directResources.map((d) => d.uid)).toEqual(['d1']);
    expect(result.current.data.find((f) => f.uid === 'child')?.directResources.map((d) => d.uid)).toEqual(['d2']);
  });

  it('never offers a folder as a migration target of its own', async () => {
    // Folders come back from the unmanaged call too, but they are the containers the table nests
    // under — only the dashboard is selectable.
    mockNamespaceResources([folder('parent'), dashboard('d1', 'parent')]);

    const { result } = renderHook(() => useMigrationData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.flatMap((f) => f.directResources.map((r) => r.resource))).toEqual(['dashboards']);
  });

  it('records the ancestor path for nested folders and leaves root/general rows pathless', async () => {
    mockNamespaceResources([
      folder('grandparent'),
      folder('parent', 'grandparent'),
      folder('child', 'parent'),
      dashboard('d1', 'child'),
      dashboard('r1', ''),
    ]);

    const { result } = renderHook(() => useMigrationData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.find((f) => f.uid === 'child')?.path).toEqual(['grandparent', 'parent']);
    expect(result.current.data.find((f) => f.uid === 'general')?.path).toEqual([]);
  });

  it('stops the ancestor walk when a parent folder is not in the listed folders', async () => {
    // `orphan` points at a parent (`ghost`) the list never returned, so the walk can't resolve it.
    mockNamespaceResources([folder('orphan', 'ghost'), dashboard('d1', 'orphan')]);

    const { result } = renderHook(() => useMigrationData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.find((f) => f.uid === 'orphan')?.path).toEqual([]);
  });

  it('falls back to the folder uid and an empty path when the containing folder is not listed', async () => {
    mockNamespaceResources([dashboard('d1', 'unlisted')]);

    const { result } = renderHook(() => useMigrationData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toHaveLength(1);
    const [row] = result.current.data;
    expect(row.title).toBe(row.uid);
    expect(row.path).toEqual([]);
    expect(row.directResources.map((d) => d.uid)).toEqual(['d1']);
  });

  it('does not loop forever on a cyclic parent reference', async () => {
    mockNamespaceResources([folder('a', 'b'), folder('b', 'a'), dashboard('d1', 'a')]);

    const { result } = renderHook(() => useMigrationData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.find((f) => f.uid === 'a')?.path).toEqual(['b']);
  });

  it('returns resource-less ancestors as containers, outside the selectable rows', async () => {
    mockNamespaceResources([folder('users'), folder('frank', 'users'), dashboard('d1', 'frank')]);

    const { result } = renderHook(() => useMigrationData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.map((f) => f.uid)).toEqual(['frank']);
    expect(result.current.data[0].parentUid).toBe('users');
    expect(result.current.containers).toEqual([
      expect.objectContaining({ uid: 'users', parentUid: undefined, resourceCount: 0, directResources: [] }),
    ]);
  });

  it('does not duplicate an ancestor that is already a row', async () => {
    mockNamespaceResources([
      folder('parent'),
      folder('child', 'parent'),
      dashboard('d1', 'parent'),
      dashboard('d2', 'child'),
    ]);

    const { result } = renderHook(() => useMigrationData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.containers).toEqual([]);
  });

  it('terminates when building containers over a cyclic parent reference', async () => {
    mockNamespaceResources([folder('a', 'b'), folder('b', 'a'), dashboard('d1', 'a')]);

    const { result } = renderHook(() => useMigrationData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.containers.map((f) => f.uid)).toEqual(['b']);
  });

  it('rolls root-level dashboards into a synthetic General row', async () => {
    mockNamespaceResources([folder('a'), dashboard('r1', 'general'), dashboard('r2', ''), dashboard('a1', 'a')]);

    const { result } = renderHook(() => useMigrationData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.find((f) => f.uid === 'general')?.resourceCount).toBe(2);
    expect(result.current.data.find((f) => f.uid === 'a')?.directResources.map((d) => d.uid)).toEqual(['a1']);
  });

  it('asks the endpoint for the unmanaged rows and for the folder tree unfiltered', async () => {
    // The folder tree has to include managed folders: a managed folder still renders as the
    // container of an unmanaged child.
    const queries: string[] = [];
    server.use(
      http.get(NAMESPACE_RESOURCES_ROUTE, ({ request }) => {
        queries.push(new URL(request.url).search);
        return HttpResponse.json({ items: [], metadata: {} });
      })
    );

    const { result } = renderHook(() => useMigrationData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(queries.some((q) => q.includes('managed=false') && !q.includes('group='))).toBe(true);
    expect(
      queries.some(
        (q) => q.includes('group=folder.grafana.app') && q.includes('resource=folders') && !q.includes('managed=')
      )
    ).toBe(true);
  });

  it('excludes app-generated (SLO app) dashboards and folders from the selectable set', async () => {
    mockNamespaceResources([
      folder('a'),
      folder('grafana_slo_app-slofolder'),
      dashboard('a1', 'a'),
      dashboard('grafana_slo_app-slodash', 'a'),
      dashboard('grafana_slo_app-slodash2', 'grafana_slo_app-slofolder'),
    ]);

    const { result } = renderHook(() => useMigrationData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.find((f) => f.uid === 'grafana_slo_app-slofolder')).toBeUndefined();
    expect(result.current.data.find((f) => f.uid === 'a')?.directResources.map((d) => d.uid)).toEqual(['a1']);
    const allUids = result.current.data.flatMap((f) => f.directResources.map((d) => d.uid));
    expect(allUids.some((uid) => uid.startsWith('grafana_slo_app-'))).toBe(false);
  });

  it('sets isError when the namespace list fails', async () => {
    server.use(http.get(NAMESPACE_RESOURCES_ROUTE, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));

    const { result } = renderHook(() => useMigrationData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.data).toEqual([]);
  });

  it('reloads the data when refetch is called', async () => {
    mockNamespaceResources([folder('a'), dashboard('d1', 'a')]);

    const { result } = renderHook(() => useMigrationData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(1);

    mockNamespaceResources([folder('a'), dashboard('d1', 'a'), folder('b'), dashboard('d2', 'b')]);
    act(() => result.current.refetch());

    await waitFor(() => expect(result.current.data).toHaveLength(2));
  });

  it('follows the continue token to the end of a paged list', async () => {
    const pages: Record<string, { items: ResourceListItem[]; next?: string }> = {
      '': { items: [folder('f'), dashboard('d1', 'f')], next: 'page-2' },
      'page-2': { items: [dashboard('d2', 'f')] },
    };
    server.use(
      http.get(NAMESPACE_RESOURCES_ROUTE, ({ request }) => {
        const params = new URL(request.url).searchParams;
        const page = pages[params.get('continue') ?? ''];
        const items = params.get('resource')
          ? page.items.filter((item) => item.resource === params.get('resource'))
          : page.items;
        return HttpResponse.json({ items, metadata: page.next ? { continue: page.next } : {} });
      })
    );

    const { result } = renderHook(() => useMigrationData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.find((f) => f.uid === 'f')?.directResources.map((d) => d.uid)).toEqual(['d1', 'd2']);
  });
});

describe('useMigrationData (non-folder kinds)', () => {
  it('groups playlists under a synthetic Playlists folder', async () => {
    mockNamespaceResources([playlist('p1', 'Morning rotation'), playlist('p2', 'Ops wall')]);

    const { result } = renderHook(() => useMigrationData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toHaveLength(1);
    const row = result.current.data[0];
    expect(row.title).toBe('Playlists');
    expect(row.directResources.map((r) => r.uid)).toEqual(['p1', 'p2']);
    expect(row.directResources.every((r) => r.kind === 'Playlist')).toBe(true);
  });

  it('falls back to the name when a resource has no title', async () => {
    mockNamespaceResources([{ ...playlist('p1'), title: '' }]);

    const { result } = renderHook(() => useMigrationData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data[0].directResources).toEqual([expect.objectContaining({ uid: 'p1', title: 'p1' })]);
  });

  it('enumerates folder-scoped and non-folder kinds together', async () => {
    mockNamespaceResources([folder('a'), dashboard('d1', 'a'), playlist('p1', 'Morning rotation')]);

    const { result } = renderHook(() => useMigrationData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.find((f) => f.uid === 'a')?.directResources.map((d) => d.uid)).toEqual(['d1']);
    expect(result.current.data.find((f) => f.title === 'Playlists')?.directResources.map((r) => r.uid)).toEqual(['p1']);
  });

  // The point of the endpoint: the kind set is the server's, so a kind the UI has no registry entry
  // for still reaches the table.
  it('lists a provisionable kind the registry has no entry for', async () => {
    mockNamespaceResources([
      {
        group: 'notifications.grafana.app',
        resource: 'receivers',
        name: 'oncall',
        title: 'On call',
        path: '',
        hash: '',
      },
    ]);
    server.use(
      http.get('/apis', () =>
        HttpResponse.json({
          items: [
            {
              metadata: { name: 'notifications.grafana.app' },
              versions: [
                { version: 'v0alpha1', resources: [{ resource: 'receivers', responseKind: { kind: 'Receiver' } }] },
              ],
            },
          ],
        })
      )
    );

    const { result } = renderHook(() => useMigrationData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const [row] = result.current.data;
    // No registry entry, so the plural resource name labels the synthetic row.
    expect(row.title).toBe('receivers');
    // The Kubernetes Kind the migrate job needs comes from discovery.
    expect(row.directResources).toEqual([
      expect.objectContaining({ uid: 'oncall', title: 'On call', kind: 'Receiver', info: undefined }),
    ]);
  });

  it('nests an unregistered kind under its folder when the list places it in one', async () => {
    mockNamespaceResources([
      folder('a'),
      { group: 'other.grafana.app', resource: 'widgets', name: 'w1', title: 'W1', folder: 'a', path: '', hash: '' },
    ]);
    server.use(http.get('/apis', () => HttpResponse.json({ items: [] })));

    const { result } = renderHook(() => useMigrationData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.find((f) => f.uid === 'a')?.directResources.map((r) => r.uid)).toEqual(['w1']);
  });

  // A data source is stored under the collection group, which no API server serves, and a job
  // addresses a resource through the group that serves it.
  it('rewrites a collection member to the group serving it', async () => {
    mockNamespaceResources([
      { group: 'datasource.grafana.app', resource: 'datasources', name: 'prom', title: 'prom', path: '', hash: '' },
      { group: 'datasource.grafana.app', resource: 'datasources', name: 'logs', title: 'logs', path: '', hash: '' },
    ]);
    server.use(
      http.get('/apis', () =>
        HttpResponse.json({
          items: ['prometheus', 'loki'].map((plugin) => ({
            metadata: { name: `${plugin}.datasource.grafana.app` },
            versions: [
              { version: 'v0alpha1', resources: [{ resource: 'datasources', responseKind: { kind: 'DataSource' } }] },
            ],
          })),
        })
      ),
      http.get('/apis/:group/v0alpha1/namespaces/:namespace/datasources', ({ params }) =>
        HttpResponse.json({
          items: [{ metadata: { name: String(params.group).startsWith('prometheus') ? 'prom' : 'logs' }, spec: {} }],
        })
      )
    );

    const { result } = renderHook(() => useMigrationData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const [row] = result.current.data;
    expect(row.title).toBe('Data sources');
    expect(row.directResources).toEqual([
      expect.objectContaining({ uid: 'prom', group: 'prometheus.datasource.grafana.app', kind: 'DataSource' }),
      expect.objectContaining({ uid: 'logs', group: 'loki.datasource.grafana.app', kind: 'DataSource' }),
    ]);
  });

  // Classic file provisioning marks a data source read-only and leaves no manager, so the index
  // reports it unmanaged even though no write can take it over.
  it('drops a read-only collection member the index reports as unmanaged', async () => {
    mockNamespaceResources([
      {
        group: 'datasource.grafana.app',
        resource: 'datasources',
        name: 'file-prom',
        title: 'prom',
        path: '',
        hash: '',
      },
    ]);
    server.use(
      http.get('/apis', () =>
        HttpResponse.json({
          items: [
            {
              metadata: { name: 'prometheus.datasource.grafana.app' },
              versions: [
                { version: 'v0alpha1', resources: [{ resource: 'datasources', responseKind: { kind: 'DataSource' } }] },
              ],
            },
          ],
        })
      ),
      http.get('/apis/:group/v0alpha1/namespaces/:namespace/datasources', () =>
        HttpResponse.json({ items: [{ metadata: { name: 'file-prom' }, spec: { readOnly: true } }] })
      )
    );

    const { result } = renderHook(() => useMigrationData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual([]);
  });

  it('reports an error when the manager filter is rejected', async () => {
    // The endpoint refuses a filter naming a kind it does not list; one request either answers or
    // the table has nothing to show.
    server.use(
      http.get(NAMESPACE_RESOURCES_ROUTE, ({ request }) =>
        new URL(request.url).searchParams.has('group')
          ? HttpResponse.json({ message: 'no provisionable resource matches' }, { status: 400 })
          : HttpResponse.json({ items: [], metadata: {} })
      )
    );

    const { result } = renderHook(() => useMigrationData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
  });
});
