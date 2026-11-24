import { config, resolveAPIBaseURL as stableResolveAPIBaseURL } from '@grafana/runtime';

import { resolveAPIVersion } from './resolveAPIVersion';
import { type ResolveAPIBaseURLOptions } from './types';

/**
 * `/apis/<group>/<version>/namespaces/<namespace>` for the version `resolveAPIVersion` picks, without the
 * namespace when `namespaced: false`. Resolves `undefined` when no version resolves. Never rejects.
 */
export async function resolveAPIBaseURL(
  group: string,
  supported: readonly string[],
  options?: ResolveAPIBaseURLOptions
): Promise<string | undefined> {
  if (typeof stableResolveAPIBaseURL === 'function') {
    return stableResolveAPIBaseURL(group, supported, options);
  }

  const version = await resolveAPIVersion(group, supported);
  if (!version) {
    return undefined;
  }
  const base = `/apis/${group}/${version}`;
  return (options?.namespaced ?? true) ? `${base}/namespaces/${config.namespace}` : base;
}
