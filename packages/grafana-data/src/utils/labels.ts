import { type Labels } from '../types/data';
import { type DataFrame, type Field, FieldType } from '../types/dataFrame';

/**
 * Synthetic facet key representing the field/metric name as a filterable dimension.
 */
export const FIELD_NAME_FACET_KEY = '__name__';

/**
 * Regexp to extract Prometheus-style labels
 */
const labelRegexp = /\b(\w+)(!?=~?)"([^"\n]*?)"/g;

/**
 * Returns a map of label keys to value from an input selector string.
 *
 * Example: `parseLabels('{job="foo", instance="bar"}) // {job: "foo", instance: "bar"}`
 */
export function parseLabels(labels: string): Labels {
  const labelsByKey: Labels = {};
  labels.replace(labelRegexp, (_, key, operator, value) => {
    labelsByKey[key] = value;
    return '';
  });
  return labelsByKey;
}

/**
 * Returns a map labels that are common to the given label sets.
 */
export function findCommonLabels(labelsSets: Labels[]): Labels {
  return labelsSets.reduce(
    (acc, labels) => {
      if (!labels) {
        throw new Error('Need parsed labels to find common labels.');
      }
      // Remove incoming labels that are missing or not matching in value
      Object.keys(labels).forEach((key) => {
        if (acc[key] === undefined || acc[key] !== labels[key]) {
          delete acc[key];
        }
      });
      // Remove common labels that are missing from incoming label set
      Object.keys(acc).forEach((key) => {
        if (labels[key] === undefined) {
          delete acc[key];
        }
      });
      return acc;
    },
    { ...labelsSets[0] }
  );
}

/**
 * Returns a map of labels that are in `labels`, but not in `commonLabels`.
 */
export function findUniqueLabels(labels: Labels | undefined, commonLabels: Labels): Labels {
  const uncommonLabels: Labels = { ...labels };
  Object.keys(commonLabels).forEach((key) => {
    delete uncommonLabels[key];
  });
  return uncommonLabels;
}

/**
 * Check that all labels exist in another set of labels
 */
export function matchAllLabels(expect: Labels, against?: Labels): boolean {
  if (!expect) {
    return true; // nothing to match
  }
  for (const [key, value] of Object.entries(expect)) {
    if (!against || against[key] !== value) {
      return false;
    }
  }
  return true;
}

/**
 * Collects unique label values per key across all fields.
 * Adds a synthetic `__name__` facet when fields have multiple distinct names.
 * Falls back to frame names when all fields share the same raw name
 * (e.g. multiple queries each returning a "Value" field with distinct frame names).
 */
export function extractFacetedLabels(frames: DataFrame[]): Record<string, string[]> {
  const valuesByKey: Record<string, Set<string>> = {};
  const fieldNames = new Set<string>();
  const frameNames = new Set<string>();

  for (const frame of frames) {
    for (const field of frame.fields) {
      if (field.type === FieldType.time) {
        continue;
      }

      fieldNames.add(field.name);

      if (frame.name) {
        frameNames.add(frame.name);
      }

      if (field.labels) {
        for (const [key, value] of Object.entries(field.labels)) {
          (valuesByKey[key] ??= new Set<string>()).add(value);
        }
      }
    }
  }

  const result: Record<string, string[]> = {};

  const names = fieldNames.size > 1 ? fieldNames : frameNames;
  if (names.size > 1) {
    result[FIELD_NAME_FACET_KEY] = Array.from(names).sort();
  }

  for (const key in valuesByKey) {
    result[key] = Array.from(valuesByKey[key]).sort();
  }

  return result;
}

/**
 * Returns display names of fields matching the faceted selection (OR within key, AND across keys).
 * Returns null when selection is empty.
 */
export function resolveFacetedFilterNames(
  frames: DataFrame[],
  selected: Record<string, string[]>,
  getDisplayName: (field: Field, frame: DataFrame, allFrames: DataFrame[]) => string
): string[] | null {
  const activeKeys = Object.entries(selected).filter(([, values]) => values.length > 0);

  if (activeKeys.length === 0) {
    return null;
  }

  const names: string[] = [];

  for (const frame of frames) {
    for (const field of frame.fields) {
      if (field.type === FieldType.time) {
        continue;
      }

      const matches = activeKeys.every(([key, allowed]) => {
        if (key === FIELD_NAME_FACET_KEY) {
          return allowed.includes(field.name) || (frame.name != null && allowed.includes(frame.name));
        }
        return field.labels?.[key] !== undefined && allowed.includes(field.labels[key]);
      });

      if (matches) {
        names.push(getDisplayName(field, frame, frames));
      }
    }
  }

  return names;
}

/**
 * Serializes the given labels to a string.
 */
export function formatLabels(labels: Labels, defaultValue = '', withoutBraces?: boolean): string {
  if (!labels || Object.keys(labels).length === 0) {
    return defaultValue;
  }
  const labelKeys = Object.keys(labels).sort();
  const cleanSelector = labelKeys.map((key) => `${key}="${labels[key]}"`).join(', ');
  if (withoutBraces) {
    return cleanSelector;
  }
  return ['{', cleanSelector, '}'].join('');
}
