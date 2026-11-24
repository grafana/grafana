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

function toAPIGroup(name: string, versions: readonly string[]) {
  const groupVersions = versions.map((version) => ({ groupVersion: `${name}/${version}`, version }));
  return { kind: 'APIGroup', apiVersion: 'v1', name, versions: groupVersions, preferredVersion: groupVersions[0] };
}

// The app also asks `/apis` for aggregated discovery. Those requests fall through to other handlers.
function isAggregatedDiscoveryRequest(request: Request): boolean {
  return (request.headers.get('accept') ?? '').includes('as=APIGroupDiscoveryList');
}

/** Handlers for the plain `GET /apis` group list and `GET /apis/<group>/`, serving only `served`. */
export function getAPIDiscoveryHandlers(served: Readonly<Record<string, readonly string[]>> = SERVED_API_VERSIONS) {
  return [
    http.get('/apis', ({ request }) => {
      if (isAggregatedDiscoveryRequest(request)) {
        return undefined;
      }
      const groups = Object.entries(served).map(([name, versions]) => toAPIGroup(name, versions));
      return HttpResponse.json({ kind: 'APIGroupList', apiVersion: 'v1', groups });
    }),

    http.get('/apis/:group/', ({ params }) => {
      const group = String(params.group);
      const versions = served[group];
      if (!versions) {
        return HttpResponse.json(getErrorResponse(`the server could not find the requested resource`, 404), {
          status: 404,
        });
      }
      return HttpResponse.json(toAPIGroup(group, versions));
    }),
  ];
}

export interface ServedAPIResource {
  resource: string;
  kind: string;
  verbs: readonly string[];
  namespaced?: boolean;
  subresources?: Readonly<Record<string, readonly string[]>>;
}

export const SERVED_API_RESOURCES: Readonly<Record<string, readonly ServedAPIResource[]>> = {
  'collections.grafana.app/v1alpha1': [{ resource: 'stars', kind: 'Stars', verbs: ['list'] }],
  'dashboard.grafana.app/v0alpha1': [],
  'dashboard.grafana.app/v1beta1': [
    { resource: 'dashboards', kind: 'Dashboard', verbs: [], subresources: { dto: ['get'] } },
  ],
  'dashboard.grafana.app/v2beta1': [
    { resource: 'dashboards', kind: 'Dashboard', verbs: [], subresources: { dto: ['get'] } },
  ],
  'folder.grafana.app/v1beta1': [
    {
      resource: 'folders',
      kind: 'Folder',
      verbs: ['create', 'get', 'list', 'patch', 'update'],
      subresources: { access: ['get'], counts: ['get'], parents: ['get'] },
    },
  ],
  'iam.grafana.app/v0alpha1': [{ resource: 'teams', kind: 'Team', verbs: ['get', 'list'] }],
  'plugins.grafana.app/v0alpha1': [{ resource: 'metas', kind: 'Meta', verbs: ['list'] }],
  'preferences.grafana.app/v1': [{ resource: 'preferences', kind: 'Preferences', verbs: ['list', 'patch'] }],
  'provisioning.grafana.app/v0alpha1': [
    {
      resource: 'connections',
      kind: 'Connection',
      verbs: ['create', 'list', 'update'],
      subresources: { repositories: ['get'] },
    },
    { resource: 'jobs', kind: 'Job', verbs: ['list'] },
    {
      resource: 'repositories',
      kind: 'Repository',
      verbs: ['create', 'list', 'update'],
      subresources: { jobs: ['create'], refs: ['get'], resources: ['get'], test: ['create'] },
    },
  ],
  'scope.grafana.app/v0alpha1': [
    { resource: 'scopenodes', kind: 'ScopeNode', verbs: ['get'] },
    { resource: 'scopes', kind: 'Scope', verbs: ['get'] },
  ],
};

function toAPIResourceList(groupVersion: string, resources: readonly ServedAPIResource[]) {
  return {
    kind: 'APIResourceList',
    apiVersion: 'v1',
    groupVersion,
    resources: resources.flatMap(({ resource, kind, verbs, namespaced = true, subresources = {} }) => [
      { name: resource, namespaced, kind, verbs },
      ...Object.entries(subresources).map(([subresource, subresourceVerbs]) => ({
        name: `${resource}/${subresource}`,
        namespaced,
        kind: '',
        verbs: subresourceVerbs,
      })),
    ]),
  };
}

function listResources(
  served: Readonly<Record<string, readonly string[]>>,
  resources: Readonly<Record<string, readonly ServedAPIResource[]>>,
  group: string,
  version: string
): readonly ServedAPIResource[] | undefined {
  const groupVersion = `${group}/${version}`;
  return Object.hasOwn(served, group) && served[group].includes(version) && Object.hasOwn(resources, groupVersion)
    ? resources[groupVersion]
    : undefined;
}

export function getAPIResourceDiscoveryHandlers(
  served: Readonly<Record<string, readonly string[]>> = SERVED_API_VERSIONS,
  resources: Readonly<Record<string, readonly ServedAPIResource[]>> = SERVED_API_RESOURCES
) {
  return [
    http.get('/apis/:group/:version', ({ params }) => {
      const group = String(params.group);
      const version = String(params.version);
      const list = listResources(served, resources, group, version);
      if (!list) {
        return HttpResponse.json(getErrorResponse(`the server could not find the requested resource`, 404), {
          status: 404,
        });
      }
      return HttpResponse.json(toAPIResourceList(`${group}/${version}`, list));
    }),
  ];
}

export default [...getAPIDiscoveryHandlers(), ...getAPIResourceDiscoveryHandlers()];
