import { type Labels } from '../types/data';
import { type DataFrame, FieldType } from '../types/dataFrame';

export interface FieldReference {
  name: string;
  labels?: Labels | null;
  occurrence?: number;
}

export function getRowIdentity(frame: DataFrame, parentIndex: number): string {
  const values: unknown[] = [];
  for (const field of frame.fields) {
    if (field.type !== FieldType.nestedFrames) {
      values.push(field.values[parentIndex]);
    }
  }
  return JSON.stringify(values);
}

function isLabels(value: unknown): value is Labels {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((label) => typeof label === 'string')
  );
}

export function isFieldReference(value: unknown): value is FieldReference {
  if (typeof value !== 'object' || value === null || !('name' in value) || typeof value.name !== 'string') {
    return false;
  }
  const labels = 'labels' in value ? value.labels : undefined;
  const occurrence = 'occurrence' in value ? value.occurrence : undefined;
  return (
    (labels == null || isLabels(labels)) &&
    (occurrence === undefined || (typeof occurrence === 'number' && Number.isInteger(occurrence) && occurrence >= 0))
  );
}

function sortedLabels(labels?: Labels | null): Array<[string, string]> | null {
  const entries = labels ? Object.entries(labels) : [];
  return entries.length > 0 ? entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)) : null;
}

export function getFieldReferenceKey({ name, labels, occurrence = 0 }: FieldReference): string {
  return JSON.stringify([name, sortedLabels(labels), occurrence]);
}

function isSameLabelValue(a: unknown, b: unknown): boolean {
  return a === b || ((typeof a !== 'string' || typeof b !== 'string') && JSON.stringify([a]) === JSON.stringify([b]));
}

export function hasSameLabels(a?: Labels | null, b?: Labels | null): boolean {
  const left = a ?? {};
  const right = b ?? {};
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && isSameLabelValue(left[key], right[key]))
  );
}

function groupByName(items: ReadonlyArray<{ name: string }>): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  items.forEach(({ name }, index) => {
    const group = groups.get(name);
    if (group) {
      group.push(index);
    } else {
      groups.set(name, [index]);
    }
  });
  return groups;
}

export function getFieldReferences(frame: DataFrame): FieldReference[] {
  const occurrences = new Array<number>(frame.fields.length).fill(0);
  for (const group of groupByName(frame.fields).values()) {
    if (group.length > 1) {
      const seen = new Map<string, number>();
      for (const index of group) {
        const labels = JSON.stringify(sortedLabels(frame.fields[index].labels));
        occurrences[index] = seen.get(labels) ?? 0;
        seen.set(labels, occurrences[index] + 1);
      }
    }
  }
  return frame.fields.map(({ name, labels }, index) => ({
    name,
    ...(labels && Object.keys(labels).length > 0 ? { labels } : {}),
    ...(occurrences[index] > 0 ? { occurrence: occurrences[index] } : {}),
  }));
}

export function createFieldReferenceResolver(frame: DataFrame): (reference: unknown) => number {
  const indexes = new Map(
    getFieldReferences(frame).map((reference, index) => [getFieldReferenceKey(reference), index])
  );
  return (reference) => (isFieldReference(reference) ? (indexes.get(getFieldReferenceKey(reference)) ?? -1) : -1);
}
