/**
 * An `/apis` group the server serves, as returned by {@link getAPIGroup}.
 *
 * A simplified version of the Kubernetes `APIGroup` response, not the response itself, so the public
 * API and the plugin-compat wrappers don't depend on the Kubernetes format. `preferredVersion` is
 * always set, and versions are plain strings.
 *
 * @alpha
 */
export interface APIGroupInfo {
  /** The group name, such as `dashboard.grafana.app`. */
  group: string;
  /** In the order the server lists them, which is its order of preference. */
  versions: readonly string[];
  /** The version the server prefers. One of `versions`. */
  preferredVersion: string;
}

/**
 * A resource the server serves in one group version, as returned by {@link getAPIResources}.
 *
 * Like {@link APIGroupInfo}, a simplified version of the Kubernetes discovery entries rather than the
 * entries themselves: subresources are folded into their resource, and the scope is a boolean.
 *
 * @alpha
 */
export interface APIResourceInfo {
  /** The group name, such as `dashboard.grafana.app`. */
  group: string;
  /** Such as `v1beta1`. */
  version: string;
  /** The plural name used in URLs, such as `dashboards`. */
  resource: string;
  /** Such as `Dashboard`. Empty when the server doesn't name it. */
  kind: string;
  /** Whether the resource lives in a namespace. `false` for cluster-scoped resources. */
  namespaced: boolean;
  /** The Kubernetes verbs it supports, such as `get`, `list` and `watch`. */
  verbs: readonly string[];
  /** Such as `status`. Empty when the resource has none. */
  subresources: readonly string[];
}

/**
 * What {@link isAPIResourceAvailable} checks.
 *
 * @alpha
 */
export interface APIResourceQuery {
  group: string;
  version: string;
  resource: string;
  subresource?: string;
  /** Checked against the subresource's verbs when `subresource` is set, otherwise the resource's. */
  verb?: string;
}

interface GroupVersionForDiscovery {
  groupVersion: string;
  version: string;
}

/** The Kubernetes `APIGroup`, served by `GET /apis/<group>/`. */
export interface K8sAPIGroup {
  name: string;
  versions: GroupVersionForDiscovery[];
  preferredVersion?: GroupVersionForDiscovery;
}

/** The Kubernetes `APIGroupList`, served by `GET /apis`. */
export interface K8sAPIGroupList {
  groups: K8sAPIGroup[];
}

/** An entry of the Kubernetes `APIResourceList`. Subresources are entries named `<resource>/<subresource>`. */
interface K8sAPIResource {
  name: string;
  kind: string;
  namespaced: boolean;
  verbs: string[];
}

/** The Kubernetes `APIResourceList`, served by `GET /apis/<group>/<version>`. */
export interface K8sAPIResourceList {
  groupVersion: string;
  resources: K8sAPIResource[];
}

interface K8sAPISubresourceDiscovery {
  subresource: string;
  verbs: string[];
}

interface K8sAPIResourceDiscovery {
  resource: string;
  responseKind?: { kind?: string };
  scope: 'Namespaced' | 'Cluster';
  verbs: string[];
  subresources?: K8sAPISubresourceDiscovery[];
}

interface K8sAPIVersionDiscovery {
  version: string;
  resources: K8sAPIResourceDiscovery[];
}

interface K8sAPIGroupDiscovery {
  metadata: { name: string };
  versions: K8sAPIVersionDiscovery[];
}

/** The Kubernetes aggregated discovery `APIGroupDiscoveryList`, served by `GET /apis` on request. */
export interface K8sAPIGroupDiscoveryList {
  items: K8sAPIGroupDiscovery[];
}
