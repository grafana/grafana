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

/**
 * A resource the server serves, as returned by {@link getAPIResources} and {@link getAllAPIResources}.
 *
 * @alpha
 */
export interface APIResourceInfo {
  /** The group that serves the resource, such as `dashboard.grafana.app`. */
  group: string;
  /** The version of the group that serves the resource, such as `v1beta1`. */
  version: string;
  /** The plural name used in URLs, such as `dashboards`. */
  resource: string;
  /** The kind of the objects, such as `Dashboard`. Empty when the server doesn't name one. */
  kind: string;
  /** Whether the objects live in a namespace. */
  namespaced: boolean;
  /** The verbs the resource supports, such as `get`, `list` and `create`. */
  verbs: readonly string[];
  /** The names of its subresources, such as `status`. Each one has verbs of its own. */
  subresources: readonly string[];
}

export interface K8sAPIResource {
  name: string;
  kind?: string;
  namespaced?: boolean;
  verbs?: string[] | null;
}

export interface K8sAPIResourceList {
  resources: K8sAPIResource[];
}

export interface K8sAPISubresourceDiscovery {
  subresource: string;
  verbs?: string[] | null;
}

export interface K8sAPIResourceDiscovery {
  resource: string;
  responseKind?: { kind?: string } | null;
  scope?: string;
  verbs?: string[] | null;
  subresources?: K8sAPISubresourceDiscovery[] | null;
}

export interface K8sAPIVersionDiscovery {
  version: string;
  freshness?: string;
  resources?: K8sAPIResourceDiscovery[] | null;
}

export interface K8sAPIGroupDiscovery {
  metadata: { name: string };
  versions?: K8sAPIVersionDiscovery[] | null;
}

export interface K8sAPIGroupDiscoveryList {
  items: K8sAPIGroupDiscovery[];
}
