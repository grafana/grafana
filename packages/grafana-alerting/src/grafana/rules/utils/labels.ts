export const GRAFANA_ORIGIN_LABEL = '__grafana_origin';

export function isPrivateLabelKey(labelKey: string) {
  return (labelKey.startsWith('__') && labelKey.endsWith('__')) || labelKey === GRAFANA_ORIGIN_LABEL;
}

export const isPrivateLabel = ([key, _]: [string, string]) => isPrivateLabelKey(key);

/**
 * Returns a map labels that are common to the given label sets.
 */
export function findCommonLabels(labelSets: Array<Record<string, string>>): Record<string, string> {
  if (!Array.isArray(labelSets) || labelSets.length === 0) {
    return {};
  }
  return labelSets.reduce(
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
    { ...labelSets[0] }
  );
}
