import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { getApiDiscoveryHandlers, SERVED_API_VERSIONS } from './discovery';

const AGGREGATED_ACCEPT =
  'application/json;g=apidiscovery.k8s.io;v=v2;as=APIGroupDiscoveryList,application/json;g=apidiscovery.k8s.io;v=v2beta1;as=APIGroupDiscoveryList,application/json';

const server = setupServer(...getApiDiscoveryHandlers());

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

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
    const response = await fetch('/apis');
    const body = await response.json();

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
    const response = await fetch('/apis/folder.grafana.app/');
    const body = await response.json();

    expect(body).toMatchObject({
      kind: 'APIGroup',
      name: 'folder.grafana.app',
      preferredVersion: { version: 'v1beta1' },
    });
  });

  it('answer 404 for a group that is not served', async () => {
    const response = await fetch('/apis/annotation.grafana.app/');

    expect(response.status).toBe(404);
  });

  it('pass aggregated discovery requests on to the next handler', async () => {
    const aggregatedHandler = http.get('/apis', () => HttpResponse.json({ kind: 'APIGroupDiscoveryList', items: [] }));
    server.resetHandlers(...getApiDiscoveryHandlers(), aggregatedHandler);

    const body = await (await fetch('/apis', { headers: { Accept: AGGREGATED_ACCEPT } })).json();

    expect(body.kind).toBe('APIGroupDiscoveryList');
  });

  it('serve only the given groups', async () => {
    server.use(...getApiDiscoveryHandlers({ 'iam.grafana.app': ['v0alpha1'] }));

    const list = await (await fetch('/apis')).json();
    const folder = await fetch('/apis/folder.grafana.app/');

    expect(list.groups.map((group: { name: string }) => group.name)).toEqual(['iam.grafana.app']);
    expect(folder.status).toBe(404);
  });
});
