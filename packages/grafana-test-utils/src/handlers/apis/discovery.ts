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

export default getAPIDiscoveryHandlers();
