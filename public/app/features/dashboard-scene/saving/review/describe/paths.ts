import { isRecord } from 'app/core/utils/isRecord';

/** jsonDiff keeps JSON-pointer escapes in path segments; undo them to read a value or show a key. */
export function unescapeSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

/** The escaped path segment for an object key, as jsonDiff writes it. */
export function escapeSegment(key: string): string {
  return key.replace(/~/g, '~0').replace(/\//g, '~1');
}

/** Reads the value at escaped path segments. */
export function valueAt(root: unknown, path: ReadonlyArray<string | number>): unknown {
  let current: unknown = root;
  for (const segment of path) {
    const key = typeof segment === 'number' ? String(segment) : unescapeSegment(segment);
    if (Array.isArray(current)) {
      current = current[Number(key)];
    } else if (isRecord(current) && Object.hasOwn(current, key)) {
      // Own keys only: element names are user data, and 'constructor' must not read Object.prototype.
      current = current[key];
    } else {
      return undefined;
    }
    if (current === undefined) {
      return undefined;
    }
  }
  return current;
}

/** Set on both sides, to different values. */
export function changedOnBothSides(path: ReadonlyArray<string | number>, before: unknown, after: unknown): boolean {
  const a = valueAt(before, path);
  const b = valueAt(after, path);
  return a !== undefined && b !== undefined && a !== b;
}

/** Array indexes are never shown: a change inside an array is a change of the array. */
export function untilIndex(path: string[]): string[] {
  const index = path.findIndex((segment) => /^\d+$/.test(segment));
  return index === -1 ? path : path.slice(0, index);
}

export function hasValueAt(root: unknown, path: ReadonlyArray<string | number>): boolean {
  return valueAt(root, path) !== undefined;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Absent, null, '' and an empty array or object all mean "not set", on either side of a change. */
export function isUnset(value: unknown): boolean {
  if (value === undefined || value === null || value === '') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return isRecord(value) && Object.keys(value).length === 0;
}

/** Plugins and registries are third-party code: a throwing supplier falls back instead of failing the summary. */
export function safely<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}
