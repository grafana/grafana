import { HttpResponse, http } from 'msw';

import { type SearchQuery } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';

/** An app kind as the apiserver serves it: its API group, and the version and plural its search is mounted at. */
export interface MockAppKind {
  group: string;
  version: string;
  kind: string;
  /** The plural the kind is served under, e.g. `things`. */
  resource: string;
}

/** An object of an app kind, with the fields its kind's search answers with. */
export interface MockAppKindObject {
  name: string;
  title: string;
  folder?: string;
  description?: string;
}

// The server's page cap: a request asking for more is answered with this many
const MAX_PAGE_SIZE = 500;

export const kindSearchRoute = (kind: MockAppKind) =>
  `/apis/${kind.group}/${kind.version}/namespaces/:namespace/${kind.resource}/search`;

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
export function getKindSearchHandler(kind: MockAppKind, objects: MockAppKindObject[]) {
  return http.post<{ namespace: string }, SearchQuery>(kindSearchRoute(kind), async ({ request }) => {
    const body = await request.json();
    const leaves = body.where?.and ?? (body.where ? [body.where] : []);
    const names = leaves.find((leaf) => leaf.filter?.field === 'name')?.filter?.values;
    const matched = names ? objects.filter((object) => names.includes(object.name)) : objects;

    return HttpResponse.json({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'SearchResults',
      metadata: { totalHits: matched.length, totalHitsRelation: 'eq' },
      items: matched.slice(0, Math.min(body.limit ?? matched.length, MAX_PAGE_SIZE)).map((object) => ({
        resource: { group: kind.group, resource: kind.resource, kind: kind.kind, name: object.name },
        fields: { title: object.title, folder: object.folder, description: object.description },
      })),
    });
  });
}
