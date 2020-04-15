import { Labels } from '../types/data';

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
  return labelsSets.reduce((acc, labels) => {
    if (!labels) {
      throw new Error('Need parsed labels to find common labels.');
    }
    if (!acc) {
      // Initial set
      acc = { ...labels };
    } else {
      // Remove incoming labels that are missing or not matching in value
      Object.keys(labels).forEach(key => {
        if (acc[key] === undefined || acc[key] !== labels[key]) {
          delete acc[key];
        }
      });
      // Remove common labels that are missing from incoming label set
      Object.keys(acc).forEach(key => {
        if (labels[key] === undefined) {
          delete acc[key];
        }
      });
    }
    return acc;
  }, (undefined as unknown) as Labels);
}

/**
 * Returns a map of labels that are in `labels`, but not in `commonLabels`.
 */
export function findUniqueLabels(labels: Labels | undefined, commonLabels: Labels): Labels {
  const uncommonLabels: Labels = { ...labels };
  Object.keys(commonLabels).forEach(key => {
    delete uncommonLabels[key];
  });
  return uncommonLabels;
}

/**
 * Serializes the given labels to a string.
 */
export function formatLabels(labels: Labels, defaultValue = ''): string {
  if (!labels || Object.keys(labels).length === 0) {
    return defaultValue;
  }
  const labelKeys = Object.keys(labels).sort();
  const cleanSelector = labelKeys.map(key => `${key}="${labels[key]}"`).join(', ');
  return ['{', cleanSelector, '}'].join('');
}
