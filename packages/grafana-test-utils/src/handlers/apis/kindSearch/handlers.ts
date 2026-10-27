import { groupBy } from 'lodash';
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
 * Answers aggregated API discovery (`GET /apis`) for the served kinds the way the apiserver does:
 * each group with its versions and their resources. Core resolves the version and plural of a
 * registered kind through this.
 */
export function getKindDiscoveryHandler(...served: MockServedKind[]) {
  return http.get('/apis', () =>
    HttpResponse.json({
      kind: 'APIGroupDiscoveryList',
      apiVersion: 'apidiscovery.k8s.io/v2',
      metadata: {},
      items: Object.entries(groupBy(served, (kind) => kind.group)).map(([group, kinds]) => ({
        metadata: { name: group },
        versions: Object.entries(groupBy(kinds, (kind) => kind.version)).map(([version, versionKinds]) => ({
          version,
          freshness: 'Current',
          resources: versionKinds.map((kind) => ({
            resource: kind.plural,
            responseKind: { group: '', version: '', kind: kind.kind },
            scope: 'Namespaced',
            singularResource: kind.plural.replace(/s$/, ''),
            verbs: ['create', 'delete', 'get', 'list', 'patch', 'update', 'watch'],
          })),
        })),
      })),
    })
  );
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
