import { compare } from 'fast-json-patch';
import { get } from 'lodash';

import {
  defaultAutoGridLayoutKind,
  defaultGridLayoutKind,
  defaultRowsLayoutKind,
  defaultSpec,
  defaultTabsLayoutKind,
  type Spec as DashboardV2Spec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { isRecord } from 'app/core/utils/isRecord';

import { type Diff } from '../../../settings/version-history/utils';
import { type PathKey } from '../types';

// --- Paths ---

/** jsonDiff keeps JSON-pointer escapes in path segments; undo them to read a value or show a key. */
export function unescapeSegment(segment: string): string {
  return segment.includes('~') ? segment.replace(/~1/g, '/').replace(/~0/g, '~') : segment;
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

/** Whether `path` starts with every segment of `prefix` (or equals it). */
export function hasPrefix(path: readonly string[], prefix: readonly string[]): boolean {
  return prefix.length <= path.length && prefix.every((segment, index) => path[index] === segment);
}

/** The path up to and including the last `segment` in it; undefined when it has none. */
export function pathUpTo(path: readonly string[], segment: string): string[] | undefined {
  const index = path.lastIndexOf(segment);
  return index === -1 ? undefined : path.slice(0, index + 1);
}

/** Gives each claim to the line whose key `keyOf` reads from it; claims no line's key matches go to the first line. */
export function assignClaims(
  lines: Array<{ key?: string; claims: PathKey[] }>,
  claims: Iterable<PathKey>,
  keyOf: (path: string[]) => string | undefined
) {
  for (const claim of claims) {
    const key = keyOf(claim.split('/'));
    (lines.find((line) => line.key !== undefined && line.key === key) ?? lines[0]).claims.push(claim);
  }
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

// --- Flat diff ---

/**
 * The flattened `jsonDiff(lhs, rhs)` without its line numbers: the same operations, path segments, values and
 * original values. jsonDiff pretty-prints both sides through json-source-map only to find line numbers, which
 * Review never shows; on large dashboards that is most of the time a summary takes.
 *
 * Ops come in path order (array indexes numerically), close to jsonDiff's line order on sorted save models.
 */
export function flatDiff(lhs: object, rhs: object): Diff[] {
  return compare(lhs, rhs)
    .map((operation): Diff => {
      // Segments stay JSON-pointer escaped, and original values are read with lodash `get`, exactly as jsonDiff does.
      const path = operation.path.split('/').slice(1);
      const value = operation.op === 'add' || operation.op === 'replace' ? operation.value : undefined;
      const originalValue = operation.op === 'replace' || operation.op === 'remove' ? get(lhs, path) : undefined;
      return { op: operation.op, value, originalValue, path, startLineNumber: 0, endLineNumber: 0 };
    })
    .sort((a, b) => comparePaths(a.path, b.path));
}

function comparePaths(a: string[], b: string[]): number {
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index++) {
    if (a[index] === b[index]) {
      continue;
    }
    const numberA = Number(a[index]);
    const numberB = Number(b[index]);
    if (Number.isInteger(numberA) && Number.isInteger(numberB)) {
      return numberA - numberB;
    }
    return a[index] < b[index] ? -1 : 1;
  }
  return a.length - b.length;
}

// --- Empty baseline ---

/**
 * The baseline a brand-new dashboard is compared against: the schema defaults with nothing in it,
 * and an empty layout of the payload's root kind, so everything the dashboard contains reads as an addition.
 */
export function emptyBaselineFor(payload: DashboardV2Spec): DashboardV2Spec {
  return {
    ...defaultSpec(),
    title: '',
    elements: {},
    variables: [],
    annotations: [],
    links: [],
    tags: [],
    layout: emptyLayoutOfKind(payload.layout.kind),
  };
}

function emptyLayoutOfKind(kind: DashboardV2Spec['layout']['kind']): DashboardV2Spec['layout'] {
  switch (kind) {
    case 'RowsLayout':
      return { ...defaultRowsLayoutKind(), spec: { rows: [] } };
    case 'TabsLayout':
      return { ...defaultTabsLayoutKind(), spec: { tabs: [] } };
    case 'AutoGridLayout': {
      // What the serializer writes for an auto grid at its defaults: settings at their default are left out.
      const { maxColumnCount, columnWidthMode, rowHeightMode } = defaultAutoGridLayoutKind().spec;
      return { kind: 'AutoGridLayout', spec: { maxColumnCount, columnWidthMode, rowHeightMode, items: [] } };
    }
    case 'GridLayout':
    default:
      return { ...defaultGridLayoutKind(), spec: { items: [] } };
  }
}
