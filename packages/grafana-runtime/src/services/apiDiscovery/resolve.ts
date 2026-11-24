import { getNamespace } from '../pluginUtils';

import { getAPIGroup, getAPIGroupOutcome, type Outcome } from './discovery';
import { selectAPIVersion } from './versions';

/**
 * @alpha
 */
export interface ResolveAPIBaseURLOptions {
  /** Whether the URL ends in the current namespace. Set `false` for cluster-scoped resources. Defaults to `true`. */
  namespaced?: boolean;
}

/**
 * Picks the version of `group` to call from the versions in `supported`: the server's preferred
 * version if `supported` lists it, otherwise the most stable version both sides have (`v1`, then
 * `v1beta1`, then `v1alpha1`). It never returns a version that `supported` doesn't list.
 *
 * Resolves `undefined` when the group is not served, when there is no version in common, or when
 * discovery can't answer (see {@link getAPIGroup}). The fallback is up to the caller.
 *
 * @alpha
 */
export async function resolveAPIVersion(group: string, supported: readonly string[]): Promise<string | undefined> {
  const info = await getAPIGroup(group);
  return info ? selectAPIVersion(info, supported) : undefined;
}

/**
 * Like {@link resolveAPIVersion}, but resolves the base URL to call:
 * `/apis/<group>/<version>/namespaces/<namespace>` for the current namespace, or
 * `/apis/<group>/<version>` with `{ namespaced: false }`. Resolves `undefined` when no version resolves.
 *
 * @example
 * ```ts
 * const baseURL = await resolveAPIBaseURL('dashboard.grafana.app', ['v1beta1', 'v2beta1']);
 * if (!baseURL) {
 *   // Not served or unknown: use the legacy API instead.
 * }
 * ```
 *
 * @alpha
 */
export async function resolveAPIBaseURL(
  group: string,
  supported: readonly string[],
  { namespaced = true }: ResolveAPIBaseURLOptions = {}
): Promise<string | undefined> {
  const version = await resolveAPIVersion(group, supported);
  return version ? toBaseURL(group, version, namespaced) : undefined;
}

/**
 * Like {@link resolveAPIBaseURL}, but tells a group that is not served in a supported version
 * (`known` with `undefined`) apart from discovery that could not answer (`unknown`).
 *
 * @internal
 */
export async function resolveAPIBaseURLOutcome(
  group: string,
  supported: readonly string[],
  { namespaced = true }: ResolveAPIBaseURLOptions = {}
): Promise<Outcome<string | undefined>> {
  const outcome = await getAPIGroupOutcome(group);
  if (outcome.kind === 'unknown') {
    return outcome;
  }
  const version = outcome.value && selectAPIVersion(outcome.value, supported);
  return { kind: 'known', value: version ? toBaseURL(group, version, namespaced) : undefined };
}

export function toBaseURL(group: string, version: string, namespaced = true): string {
  const base = `/apis/${group}/${version}`;
  return namespaced ? `${base}/namespaces/${getNamespace()}` : base;
}
