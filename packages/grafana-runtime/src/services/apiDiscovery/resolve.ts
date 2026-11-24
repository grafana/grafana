import { config } from '../../config';

import { getApiGroup } from './discovery';
import { selectApiVersion } from './versions';

/**
 * @alpha
 */
export interface ResolveApiBaseURLOptions {
  /** Whether the URL ends in the current namespace. Set `false` for cluster-scoped resources. Defaults to `true`. */
  namespaced?: boolean;
}

/**
 * Picks the version of `group` to call from the versions in `supported`: the server's preferred
 * version if `supported` lists it, otherwise the most stable version both sides have (`v1`, then
 * `v1beta1`, then `v1alpha1`). It never returns a version that `supported` doesn't list.
 *
 * Resolves `undefined` when the group is not served, when there is no version in common, or when
 * discovery can't answer (see {@link getApiGroup}). The fallback is up to the caller.
 *
 * @alpha
 */
export async function resolveApiVersion(group: string, supported: readonly string[]): Promise<string | undefined> {
  const info = await getApiGroup(group);
  return info ? selectApiVersion(info, supported) : undefined;
}

/**
 * Like {@link resolveApiVersion}, but resolves the base URL to call:
 * `/apis/<group>/<version>/namespaces/<namespace>` for the current namespace, or
 * `/apis/<group>/<version>` with `{ namespaced: false }`. Resolves `undefined` when no version resolves.
 *
 * @example
 * ```ts
 * const baseURL = await resolveApiBaseURL('dashboard.grafana.app', ['v1beta1', 'v2beta1']);
 * if (!baseURL) {
 *   // Not served or unknown: use the legacy API instead.
 * }
 * ```
 *
 * @alpha
 */
export async function resolveApiBaseURL(
  group: string,
  supported: readonly string[],
  { namespaced = true }: ResolveApiBaseURLOptions = {}
): Promise<string | undefined> {
  const version = await resolveApiVersion(group, supported);
  if (!version) {
    return undefined;
  }
  const base = `/apis/${group}/${version}`;
  return namespaced ? `${base}/namespaces/${config.namespace}` : base;
}
