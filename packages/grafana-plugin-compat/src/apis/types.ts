/** Declared here because `@grafana/runtime` lacks it on older supported hosts. */
export interface APIGroupInfo {
  /** The group name, such as `dashboard.grafana.app`. */
  group: string;
  /** In the order the server lists them, which is its order of preference. */
  versions: readonly string[];
  /** The version the server prefers. One of `versions`. */
  preferredVersion: string;
}

/** Declared here because `@grafana/runtime` lacks it on older supported hosts. */
export interface ResolveAPIBaseURLOptions {
  /** Whether the URL ends in the current namespace. Set `false` for cluster-scoped resources. Defaults to `true`. */
  namespaced?: boolean;
}
