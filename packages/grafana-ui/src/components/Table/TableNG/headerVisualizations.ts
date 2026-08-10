import memoize from 'micro-memoize';

import { buildHistogram, type Field, FieldType } from '@grafana/data';

export const HEADER_HISTOGRAM_BUCKET_COUNT = 12;
export const HEADER_CATEGORY_LIMIT = 5;

export interface HeaderHistogramDistribution {
  kind: 'histogram';
  x: number[];
  counts: number[];
  min: number;
  max: number;
  nullCount: number;
  invalidCount: number;
  totalCount: number;
}

export interface HeaderCategorySegment {
  label: string;
  count: number;
  type: 'value' | 'other' | 'null';
}

export interface HeaderCategoryDistribution {
  kind: 'categories';
  segments: HeaderCategorySegment[];
  totalCount: number;
}

export type HeaderDistribution = HeaderHistogramDistribution | HeaderCategoryDistribution;

function numericValue(value: unknown): number | undefined {
  if (value instanceof Date) {
    return Number.isFinite(value.valueOf()) ? value.valueOf() : undefined;
  }
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function buildHistogramDistribution(field: Field): HeaderHistogramDistribution | undefined {
  const finiteValues: number[] = [];
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let nullCount = 0;
  let invalidCount = 0;

  for (const value of field.values) {
    if (value == null) {
      nullCount++;
      continue;
    }

    const numeric = numericValue(value);
    if (numeric == null) {
      invalidCount++;
      continue;
    }
    finiteValues.push(numeric);
    min = Math.min(min, numeric);
    max = Math.max(max, numeric);
  }

  if (finiteValues.length === 0) {
    return undefined;
  }

  const histogram = buildHistogram(
    [
      {
        fields: [{ ...field, type: FieldType.number, values: finiteValues }],
        length: finiteValues.length,
      },
    ],
    { bucketCount: HEADER_HISTOGRAM_BUCKET_COUNT }
  );
  const counts = histogram?.counts[0]?.values;
  const x = histogram?.xMin.values;

  if (!counts?.length || !x?.length) {
    return undefined;
  }

  return {
    kind: 'histogram',
    x,
    counts,
    min,
    max,
    nullCount,
    invalidCount,
    totalCount: field.values.length,
  };
}

function buildCategoryDistribution(field: Field): HeaderCategoryDistribution | undefined {
  if (field.values.length === 0) {
    return undefined;
  }

  const counts = new Map<string, { count: number; order: number }>();
  let nullCount = 0;

  for (const value of field.values) {
    if (value == null) {
      nullCount++;
      continue;
    }

    const label = String(value);
    const existing = counts.get(label);
    if (existing) {
      existing.count++;
    } else {
      counts.set(label, { count: 1, order: counts.size });
    }
  }

  const sorted = Array.from(counts, ([label, value]) => ({ label, ...value })).sort(
    (a, b) => b.count - a.count || a.order - b.order
  );
  const top = sorted.slice(0, HEADER_CATEGORY_LIMIT);
  const otherCount = sorted.slice(HEADER_CATEGORY_LIMIT).reduce((sum, category) => sum + category.count, 0);
  const segments: HeaderCategorySegment[] = top.map(({ label, count }) => ({
    label,
    count,
    type: 'value',
  }));

  if (otherCount > 0) {
    segments.push({ label: 'Other', count: otherCount, type: 'other' });
  }
  if (nullCount > 0) {
    segments.push({ label: 'Null', count: nullCount, type: 'null' });
  }

  return segments.length > 0 ? { kind: 'categories', segments, totalCount: field.values.length } : undefined;
}

export function buildHeaderDistribution(field: Field): HeaderDistribution | undefined {
  switch (field.type) {
    case FieldType.number:
    case FieldType.time:
      return buildHistogramDistribution(field);
    case FieldType.string:
    case FieldType.enum:
    case FieldType.boolean:
      return buildCategoryDistribution(field);
    default:
      return undefined;
  }
}

export const getHeaderDistribution = memoize(buildHeaderDistribution, {
  maxSize: 100,
  isMatchingKey: ([fieldA], [fieldB]) => fieldA.type === fieldB.type && fieldA.values === fieldB.values,
});
