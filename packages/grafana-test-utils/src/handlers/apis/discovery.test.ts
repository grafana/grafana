import { getResponse } from 'msw';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { getAPIDiscoveryHandlers, SERVED_API_VERSIONS } from './discovery';

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
