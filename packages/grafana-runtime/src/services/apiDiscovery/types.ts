/**
 * An API group the server serves.
 *
 * @alpha
 */
export interface ApiGroupInfo {
  group: string;
  /** In the order the server lists them, which is its order of preference. */
  versions: readonly string[];
  preferredVersion: string;
}

interface GroupVersionForDiscovery {
  groupVersion: string;
  version: string;
}

/** The Kubernetes `APIGroup`, served by `GET /apis/<group>/`. */
export interface APIGroup {
  name: string;
  versions: GroupVersionForDiscovery[];
  preferredVersion?: GroupVersionForDiscovery;
}

/** The Kubernetes `APIGroupList`, served by `GET /apis`. */
export interface APIGroupList {
  groups: APIGroup[];
}
