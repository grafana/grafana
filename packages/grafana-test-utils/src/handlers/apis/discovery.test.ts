import { getResponse } from 'msw';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import discoveryHandlers, {
  getAPIDiscoveryHandlers,
  getAPIResourceDiscoveryHandlers,
  SERVED_API_RESOURCES,
  SERVED_API_VERSIONS,
} from './discovery';

// The handlers use relative paths, which MSW resolves against the page in jsdom. The package tests
// run in Node, so the origin is passed explicitly.
const ORIGIN = 'http://localhost';

const AGGREGATED_ACCEPT =
  'application/json;g=apidiscovery.k8s.io;v=v2;as=APIGroupDiscoveryList,application/json;g=apidiscovery.k8s.io;v=v2beta1;as=APIGroupDiscoveryList,application/json';

function request(path: string, init?: RequestInit, handlers = getAPIDiscoveryHandlers()) {
  return getResponse(handlers, new Request(`${ORIGIN}${path}`, init), { baseUrl: ORIGIN });
}

function listDirectories(path: string): string[] {
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

describe('API discovery handlers', () => {
  it('serve every group and version that has a handler folder', () => {
    const fromFolders = Object.fromEntries(
      listDirectories(__dirname).map((group) => [group, listDirectories(join(__dirname, group))])
    );
    const served = Object.fromEntries(
      Object.entries(SERVED_API_VERSIONS).map(([group, versions]) => [group, [...versions].sort()])
    );

    expect(served).toEqual(fromFolders);
  });

  it('answer GET /apis with an APIGroupList', async () => {
    const body = await (await request('/apis'))?.json();

    expect(body.kind).toBe('APIGroupList');
    expect(body.groups).toContainEqual({
      kind: 'APIGroup',
      apiVersion: 'v1',
      name: 'dashboard.grafana.app',
      versions: SERVED_API_VERSIONS['dashboard.grafana.app'].map((version) => ({
        groupVersion: `dashboard.grafana.app/${version}`,
        version,
      })),
      preferredVersion: { groupVersion: 'dashboard.grafana.app/v1beta1', version: 'v1beta1' },
    });
  });

  it('answer GET /apis/<group>/ with the APIGroup', async () => {
    const body = await (await request('/apis/folder.grafana.app/'))?.json();

    expect(body).toMatchObject({
      kind: 'APIGroup',
      name: 'folder.grafana.app',
      preferredVersion: { version: 'v1beta1' },
    });
  });

  it('answer 404 for a group that is not served', async () => {
    const response = await request('/apis/annotation.grafana.app/');

    expect(response?.status).toBe(404);
  });

  it('leave aggregated discovery requests to other handlers', async () => {
    await expect(request('/apis', { headers: { Accept: AGGREGATED_ACCEPT } })).resolves.toBeUndefined();
  });

  it('serve only the given groups', async () => {
    const handlers = getAPIDiscoveryHandlers({ 'iam.grafana.app': ['v0alpha1'] });

    const list = await (await request('/apis', undefined, handlers))?.json();
    const folder = await request('/apis/folder.grafana.app/', undefined, handlers);

    expect(list.groups.map((group: { name: string }) => group.name)).toEqual(['iam.grafana.app']);
    expect(folder?.status).toBe(404);
  });
});

describe('API resource discovery handlers', () => {
  it('list resources only for served group versions', () => {
    for (const groupVersion of Object.keys(SERVED_API_RESOURCES)) {
      const [group, version] = groupVersion.split('/');

      expect(SERVED_API_VERSIONS[group]).toContain(version);
    }
  });

  it('answer GET /apis/<group>/<version> with an APIResourceList', async () => {
    const response = await request('/apis/folder.grafana.app/v1beta1', undefined, getAPIResourceDiscoveryHandlers());
    const body = await response?.json();

    expect(body).toMatchObject({ kind: 'APIResourceList', groupVersion: 'folder.grafana.app/v1beta1' });
    expect(body.resources).toContainEqual({
      name: 'folders',
      namespaced: true,
      kind: 'Folder',
      verbs: ['create', 'get', 'list', 'patch', 'update'],
    });
    expect(body.resources).toContainEqual({ name: 'folders/access', namespaced: true, kind: '', verbs: ['get'] });
  });

  it.each([
    ['a version that serves routes only', '/apis/quotas.grafana.app/v0alpha1'],
    ['a version that is not served', '/apis/folder.grafana.app/v1'],
    ['a group that is not served', '/apis/annotation.grafana.app/v0alpha1'],
  ])('answer 404 for %s', async (_, path) => {
    const response = await request(path, undefined, getAPIResourceDiscoveryHandlers());

    expect(response?.status).toBe(404);
  });

  it('serve only the given resources', async () => {
    const teams = { resource: 'teams', kind: 'Team', verbs: ['list'], namespaced: false };
    const handlers = getAPIResourceDiscoveryHandlers(
      { 'iam.grafana.app': ['v0alpha1'] },
      { 'iam.grafana.app/v0alpha1': [teams] }
    );

    const list = await (await request('/apis/iam.grafana.app/v0alpha1', undefined, handlers))?.json();
    const folder = await request('/apis/folder.grafana.app/v1beta1', undefined, handlers);

    expect(list.resources).toEqual([{ name: 'teams', namespaced: false, kind: 'Team', verbs: ['list'] }]);
    expect(folder?.status).toBe(404);
  });

  it('serve the default resources only for the given group versions', async () => {
    const handlers = getAPIResourceDiscoveryHandlers({ 'iam.grafana.app': ['v0alpha1'] });

    const teams = await request('/apis/iam.grafana.app/v0alpha1', undefined, handlers);
    const folder = await request('/apis/folder.grafana.app/v1beta1', undefined, handlers);

    expect(teams?.status).toBe(200);
    expect(folder?.status).toBe(404);
  });

  it('answer aggregated GET /apis with every served group version and its resources', async () => {
    const response = await request(
      '/apis',
      { headers: { Accept: AGGREGATED_ACCEPT } },
      getAPIResourceDiscoveryHandlers()
    );
    const body = await response?.json();

    expect(response?.headers.get('Content-Type')).toContain('as=APIGroupDiscoveryList');
    expect(body.kind).toBe('APIGroupDiscoveryList');
    expect(body.items.map((item: { metadata: { name: string } }) => item.metadata.name)).toEqual(
      Object.keys(SERVED_API_VERSIONS)
    );
    expect(body.items).toContainEqual({
      metadata: { name: 'folder.grafana.app' },
      versions: [
        {
          version: 'v1beta1',
          freshness: 'Current',
          resources: [
            {
              resource: 'folders',
              responseKind: { group: '', version: '', kind: 'Folder' },
              scope: 'Namespaced',
              singularResource: '',
              verbs: ['create', 'get', 'list', 'patch', 'update'],
              subresources: [
                { subresource: 'access', verbs: ['get'] },
                { subresource: 'counts', verbs: ['get'] },
                { subresource: 'parents', verbs: ['get'] },
              ],
            },
          ],
        },
      ],
    });
  });

  it('list a version without resources the way Kubernetes does, and keep versions in order of preference', async () => {
    const response = await request(
      '/apis',
      { headers: { Accept: AGGREGATED_ACCEPT } },
      getAPIResourceDiscoveryHandlers()
    );
    const { items } = await response?.json();
    const versionsOf = (group: string) =>
      items.find((item: { metadata: { name: string } }) => item.metadata.name === group).versions;

    expect(versionsOf('quotas.grafana.app')).toEqual([{ version: 'v0alpha1', freshness: 'Current' }]);
    expect(versionsOf('dashboard.grafana.app').map(({ version }: { version: string }) => version)).toEqual(
      SERVED_API_VERSIONS['dashboard.grafana.app']
    );
  });

  it('leave plain group list requests to the other handlers', async () => {
    await expect(request('/apis', undefined, getAPIResourceDiscoveryHandlers())).resolves.toBeUndefined();
  });

  it('answer both forms of GET /apis by default', async () => {
    const plain = await (await request('/apis', undefined, discoveryHandlers))?.json();
    const aggregated = await (
      await request('/apis', { headers: { Accept: AGGREGATED_ACCEPT } }, discoveryHandlers)
    )?.json();

    expect(plain.kind).toBe('APIGroupList');
    expect(aggregated.kind).toBe('APIGroupDiscoveryList');
  });
});
