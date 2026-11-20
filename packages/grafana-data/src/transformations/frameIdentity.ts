import { type Labels } from '../types/data';
import { type DataFrame, FieldType } from '../types/dataFrame';

export interface FieldReference {
  name: string;
  labels?: Labels;
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
    (labels === undefined || isLabels(labels)) &&
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

export function getFieldReferences(frame: DataFrame): FieldReference[] {
  const seen = new Map<string, number>();
  return frame.fields.map(({ name, labels }) => {
    const identity = getFieldReferenceKey({ name, labels });
    const occurrence = seen.get(identity) ?? 0;
    seen.set(identity, occurrence + 1);
    return {
      name,
      ...(labels && Object.keys(labels).length > 0 ? { labels } : {}),
      ...(occurrence > 0 ? { occurrence } : {}),
    };
  });
}

export function createFieldReferenceResolver(frame: DataFrame): (reference: unknown) => number {
  const indexes = new Map(
    getFieldReferences(frame).map((reference, index) => [getFieldReferenceKey(reference), index])
  );
  return (reference) => (isFieldReference(reference) ? (indexes.get(getFieldReferenceKey(reference)) ?? -1) : -1);
}
