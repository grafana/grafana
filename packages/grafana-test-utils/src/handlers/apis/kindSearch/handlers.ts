import { HttpResponse, http } from 'msw';

/** A kind served by the app platform, as the discovery and per-kind search handlers describe it. */
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

type WhereNode = {
  and?: WhereNode[];
  filter?: { field: string; values: string[] };
};

export const kindSearchRoute = (served: MockServedKind) =>
  `/apis/${served.group}/${served.version}/namespaces/:namespace/${served.plural}/search`;

/**
 * Answers API discovery for one served kind the way the apiserver does: the group's versions, and
 * the resources of that version. Core resolves starred names of a plugin kind through these.
 */
export function getKindDiscoveryHandlers(served: MockServedKind) {
  return [
    http.get(`/apis/${served.group}/`, () =>
      HttpResponse.json({
        kind: 'APIGroup',
        name: served.group,
        versions: [{ groupVersion: `${served.group}/${served.version}`, version: served.version }],
        preferredVersion: { groupVersion: `${served.group}/${served.version}`, version: served.version },
      })
    ),
    http.get(`/apis/${served.group}/${served.version}`, () =>
      HttpResponse.json({
        kind: 'APIResourceList',
        groupVersion: `${served.group}/${served.version}`,
        resources: [
          { name: served.plural, singularName: served.plural.replace(/s$/, ''), namespaced: true, kind: served.kind },
          { name: `${served.plural}/search`, namespaced: true, kind: 'SearchResults' },
        ],
      })
    ),
  ];
}

/**
 * Serves a kind's per-kind search for the given objects, honoring the `name` filter leaf and
 * `limit`. Absent fields are omitted from `fields`, as the real endpoint does.
 */
export function getKindSearchHandler(served: MockServedKind, resources: MockKindResource[]) {
  return http.post(kindSearchRoute(served), async ({ request }) => {
    const body = (await request.json()) as { where?: WhereNode; limit?: number };
    const leaves = body.where?.and ?? (body.where ? [body.where] : []);
    const names = leaves.find((leaf) => leaf.filter?.field === 'name')?.filter?.values;
    const matched = names ? resources.filter((resource) => names.includes(resource.name)) : resources;

    return HttpResponse.json({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'SearchResults',
      metadata: { totalHits: matched.length, totalHitsRelation: 'eq' },
      items: matched.slice(0, body.limit ?? matched.length).map((resource) => ({
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
