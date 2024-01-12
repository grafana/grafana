import { DataFrame, Labels, roundDecimals } from '@grafana/data';
import { CombinedRuleNamespace } from 'app/types/unified-alerting';

import { isCloudRulesSource } from '../../utils/datasource';

/**
 * ⚠️ `frame.fields` could be an empty array ⚠️
 *
 * TypeScript will NOT complain about it when accessing items via index signatures.
 * Make sure to check for empty array or use optional chaining!
 *
 * see https://github.com/Microsoft/TypeScript/issues/13778
 */

const getSeriesName = (frame: DataFrame): string | undefined => {
  const firstField = frame.fields[0];

  const displayNameFromDS = firstField?.config?.displayNameFromDS;
  return displayNameFromDS ?? frame.name ?? firstField?.labels?.__name__;
};

const getSeriesValue = (frame: DataFrame) => {
  const value = frame.fields[0]?.values[0];

  if (Number.isFinite(value)) {
    return roundDecimals(value, 5);
  }

  return value;
};

const getSeriesLabels = (frame: DataFrame): Record<string, string> => {
  const firstField = frame.fields[0];
  return firstField?.labels ?? {};
};

const formatLabels = (labels: Labels): string => {
  return Object.entries(labels)
    .map(([key, value]) => key + '=' + value)
    .join(', ');
};

/**
 * After https://github.com/grafana/grafana/pull/74600,
 * Grafana folder names will be returned from the API as a combination of the folder name and parent UID in a format of JSON array,
 * where first element is parent UID and the second element is Title.
 */
const decodeGrafanaNamespace = (namespace: CombinedRuleNamespace): string => {
  const nameSpaceName = namespace.name;

  if (isCloudRulesSource(namespace.rulesSource)) {
    return nameSpaceName;
  }

  if (nameSpaceName.indexOf('[') !== 0) {
    return nameSpaceName;
  }

  let arr: string[];
  try {
    arr = JSON.parse(nameSpaceName);
  } catch {
    // if failed to parse, return as is
    return nameSpaceName;
  }
  if (arr.length !== 2) {
    return nameSpaceName;
  }
  return arr[1];
};

const isEmptySeries = (series: DataFrame[]): boolean => {
  const isEmpty = series.every((serie) => serie.fields.every((field) => field.values.every((value) => value == null)));

  return isEmpty;
};

export { decodeGrafanaNamespace, formatLabels, getSeriesLabels, getSeriesName, getSeriesValue, isEmptySeries };
