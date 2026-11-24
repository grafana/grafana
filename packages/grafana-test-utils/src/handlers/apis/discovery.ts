import { HttpResponse, http } from 'msw';

import { getErrorResponse } from '../helpers';

/**
 * The groups and versions that have a handler folder next to this file. The first version is the
 * preferred one, as in a Kubernetes `APIGroup`.
 */
export const SERVED_API_VERSIONS: Readonly<Record<string, readonly string[]>> = {
  'collections.grafana.app': ['v1alpha1'],
  'dashboard.grafana.app': ['v1beta1', 'v2beta1', 'v0alpha1'],
  'folder.grafana.app': ['v1beta1'],
  'iam.grafana.app': ['v0alpha1'],
  'plugins.grafana.app': ['v0alpha1'],
  'preferences.grafana.app': ['v1'],
  'provisioning.grafana.app': ['v0alpha1'],
  'quotas.grafana.app': ['v0alpha1'],
  'scope.grafana.app': ['v0alpha1'],
};

/** A resource one group version serves, keyed in `resources` by `<group>/<version>`. */
export interface ServedAPIResource {
  resource: string;
  kind: string;
  namespaced: boolean;
  verbs: readonly string[];
  subresources?: ReadonlyArray<{ subresource: string; verbs: readonly string[] }>;
}

type ServedAPIVersions = Readonly<Record<string, readonly string[]>>;
type ServedAPIResources = Readonly<Record<string, readonly ServedAPIResource[]>>;

const AGGREGATED_DISCOVERY_CONTENT_TYPE = 'application/json;g=apidiscovery.k8s.io;v=v2;as=APIGroupDiscoveryList';

function toAPIGroup(name: string, versions: readonly string[]) {
  const groupVersions = versions.map((version) => ({ groupVersion: `${name}/${version}`, version }));
  return { kind: 'APIGroup', apiVersion: 'v1', name, versions: groupVersions, preferredVersion: groupVersions[0] };
}

function toAPIResourceList(groupVersion: string, resources: readonly ServedAPIResource[]) {
  const entries = resources.flatMap(({ resource, kind, namespaced, verbs, subresources = [] }) => [
    { name: resource, kind, namespaced, verbs },
    ...subresources.map((sub) => ({ name: `${resource}/${sub.subresource}`, kind, namespaced, verbs: sub.verbs })),
  ]);
  return { kind: 'APIResourceList', apiVersion: 'v1', groupVersion, resources: entries };
}

function toAPIGroupDiscoveryList(served: ServedAPIVersions, resources: ServedAPIResources) {
  const items = Object.entries(served).map(([group, versions]) => ({
    metadata: { name: group },
    versions: versions.map((version) => {
      const responseKind = (kind: string) => ({ group, version, kind });
      return {
        version,
        freshness: 'Current',
        resources: (resources[`${group}/${version}`] ?? []).map(
          ({ resource, kind, namespaced, verbs, subresources }) => ({
            resource,
            responseKind: responseKind(kind),
            scope: namespaced ? 'Namespaced' : 'Cluster',
            verbs,
            ...(subresources && {
              subresources: subresources.map((sub) => ({ ...sub, responseKind: responseKind(kind) })),
            }),
          })
        ),
      };
    }),
  }));
  return { kind: 'APIGroupDiscoveryList', apiVersion: 'apidiscovery.k8s.io/v2', metadata: {}, items };
}

function notFound() {
  return HttpResponse.json(getErrorResponse(`the server could not find the requested resource`, 404), { status: 404 });
}

// `/apis` serves the aggregated discovery list instead of the group list when the client asks for it.
function isAggregatedDiscoveryRequest(request: Request): boolean {
  return (request.headers.get('accept') ?? '').includes('as=APIGroupDiscoveryList');
}

/**
 * Handlers for `GET /apis` (the group list, or the aggregated discovery list when asked for),
 * `GET /apis/<group>/` and `GET /apis/<group>/<version>`, serving only `served`. A group version
 * lists the `resources` under its `<group>/<version>` key, and none by default.
 */
export function getAPIDiscoveryHandlers(
  served: ServedAPIVersions = SERVED_API_VERSIONS,
  resources: ServedAPIResources = {}
) {
  return [
    http.get('/apis', ({ request }) => {
      if (isAggregatedDiscoveryRequest(request)) {
        return HttpResponse.json(toAPIGroupDiscoveryList(served, resources), {
          headers: { 'Content-Type': AGGREGATED_DISCOVERY_CONTENT_TYPE },
        });
      }
      const groups = Object.entries(served).map(([name, versions]) => toAPIGroup(name, versions));
      return HttpResponse.json({ kind: 'APIGroupList', apiVersion: 'v1', groups });
    }),

    http.get('/apis/:group/', ({ params }) => {
      const group = String(params.group);
      const versions = served[group];
      if (!versions) {
        return notFound();
      }
      return HttpResponse.json(toAPIGroup(group, versions));
    }),

    http.get('/apis/:group/:version', ({ params }) => {
      const group = String(params.group);
      const version = String(params.version);
      if (!served[group]?.includes(version)) {
        return notFound();
      }
      const groupVersion = `${group}/${version}`;
      return HttpResponse.json(toAPIResourceList(groupVersion, resources[groupVersion] ?? []));
    }),
  ];
}

export default getAPIDiscoveryHandlers();
