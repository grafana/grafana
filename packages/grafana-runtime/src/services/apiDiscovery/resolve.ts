import { config } from '../../config';

import { getApiGroup } from './discovery';
import { selectApiVersion } from './versions';

/**
 * @alpha
 */
export interface ResolveApiBaseURLOptions {
  /** Whether the URL ends in the current namespace. Defaults to `true`. */
  namespaced?: boolean;
}

/**
 * Resolves the version of `group` to use: the server's preferred version if `supported` lists it,
 * otherwise the most stable version both sides have. Returns `undefined` when there is none, or when
 * discovery cannot answer. It never picks a legacy fallback; that is the caller's decision.
 *
 * @alpha
 */
export async function resolveApiVersion(group: string, supported: readonly string[]): Promise<string | undefined> {
  const info = await getApiGroup(group);
  return info ? selectApiVersion(info, supported) : undefined;
}

/**
 * Resolves the base URL for `group`, such as `/apis/<group>/<version>/namespaces/<namespace>`, using
 * the version from {@link resolveApiVersion}. Returns `undefined` when no version resolves.
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
