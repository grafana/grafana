import { isEqual } from 'lodash';

export interface CodeConflict {
  path: string;
  base: unknown;
  local: unknown;
  incoming: unknown;
}

export type CodeResolution = 'local' | 'incoming';

export function mergeDashboardCode(
  base: unknown,
  local: unknown,
  incoming: unknown,
  resolutions: Record<string, CodeResolution> = {}
) {
  const conflicts: CodeConflict[] = [];
  function merge(base: unknown, local: unknown, incoming: unknown, path: string): unknown {
    if (isEqual(local, incoming) || isEqual(base, incoming)) {
      return local;
    }
    if (isEqual(base, local)) {
      return incoming;
    }
    if (isRecord(base) && isRecord(local) && isRecord(incoming)) {
      const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(incoming)]);
      return Object.fromEntries(
        [...keys]
          .map((key) => [
            key,
            merge(
              Object.hasOwn(base, key) ? base[key] : undefined,
              Object.hasOwn(local, key) ? local[key] : undefined,
              Object.hasOwn(incoming, key) ? incoming[key] : undefined,
              `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`
            ),
          ])
          .filter(([, value]) => value !== undefined)
      );
    }
    // Array indices are not stable identities: review concurrent list edits together.
    conflicts.push({ path, base, local, incoming });
    return resolutions[path] === 'incoming' ? incoming : local;
  }
  return { value: merge(base, local, incoming, ''), conflicts };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
