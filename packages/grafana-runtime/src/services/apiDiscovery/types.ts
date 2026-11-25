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
  readonly group: string;
  /** In the order the server lists them, which is its order of preference. */
  readonly versions: readonly string[];
  /** The version the server prefers. One of `versions`. */
  readonly preferredVersion: string;
}

interface GroupVersionForDiscovery {
  version: string;
}

/** The Kubernetes `APIGroup`, served by `GET /apis/<group>/`. Only the fields discovery reads. */
export interface K8sAPIGroup {
  name: string;
  versions: GroupVersionForDiscovery[];
  preferredVersion?: GroupVersionForDiscovery;
}

/** The Kubernetes `APIGroupList`, served by `GET /apis`. */
export interface K8sAPIGroupList {
  groups: K8sAPIGroup[];
}
