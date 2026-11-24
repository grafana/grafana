import { HttpResponse, http } from 'msw';

import { type GlobalSearchQuery } from '@grafana/api-clients/rtkq/search/v0alpha1';

/** A kind served by the app platform, as its API group and its per-kind search answer for it. */
export interface MockServedKind {
  group: string;
  version: string;
  kind: string;
  /** The resource name, e.g. `pages`. */
  plural: string;
}

export interface MockKindResource {
  name: string;
  title: string;
  folder?: string;
  description?: string;
  tags?: string[];
}

// The server's page cap: a request asking for more is answered with this many
const MAX_PAGE_SIZE = 500;

export const kindSearchRoute = (served: MockServedKind) =>
  `/apis/${served.group}/${served.version}/namespaces/:namespace/${served.plural}/search`;

/**
 * Answers the discovery of one API group (`GET /apis/{group}/`) the way the apiserver does: the versions the
 * group serves, the first of them preferred. A group given no version is not registered, which is a 404.
 */
export function getAPIGroupHandler(group: string, ...versions: string[]) {
  return http.get(`/apis/${group}/`, () => {
    if (versions.length === 0) {
      return new HttpResponse(null, { status: 404 });
    }
    const served = versions.map((version) => ({ groupVersion: `${group}/${version}`, version }));
    return HttpResponse.json({
      kind: 'APIGroup',
      apiVersion: 'v1',
      name: group,
      versions: served,
      preferredVersion: served[0],
    });
  });
}

/**
 * Serves a kind's per-kind search for the given objects, honoring the `name` filter leaf and
 * `limit`, up to the server's page cap. Absent fields are omitted from `fields`, as the real
 * endpoint does.
 */
export function getKindSearchHandler(served: MockServedKind, resources: MockKindResource[]) {
  return http.post(kindSearchRoute(served), async ({ request }) => {
    const body = (await request.json()) as GlobalSearchQuery;
    const leaves = body.where?.and ?? (body.where ? [body.where] : []);
    const names = leaves.find((leaf) => leaf.filter?.field === 'name')?.filter?.values;
    const matched = names ? resources.filter((resource) => names.includes(resource.name)) : resources;

    return HttpResponse.json({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'SearchResults',
      metadata: { totalHits: matched.length, totalHitsRelation: 'eq' },
      items: matched.slice(0, Math.min(body.limit ?? matched.length, MAX_PAGE_SIZE)).map((resource) => ({
        resource: { group: served.group, resource: served.plural, kind: served.kind, name: resource.name },
        fields: {
          title: resource.title,
          folder: resource.folder,
          description: resource.description,
          tags: resource.tags,
        },
      })),
    });
  });
}
