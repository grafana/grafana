import { resolveAPIVersion as stableResolveAPIVersion } from '@grafana/runtime';

import { getAPIGroup } from './getAPIGroup';
import { selectAPIVersion } from './versions';

/**
 * The server's preferred version of `group` if `supported` lists it, else the most stable one both have.
 * Resolves `undefined` when there is none or discovery can't answer. Never rejects.
 */
export async function resolveAPIVersion(group: string, supported: readonly string[]): Promise<string | undefined> {
  if (typeof stableResolveAPIVersion === 'function') {
    return stableResolveAPIVersion(group, supported);
  }

  const info = await getAPIGroup(group);
  return info ? selectAPIVersion(info, supported) : undefined;
}
