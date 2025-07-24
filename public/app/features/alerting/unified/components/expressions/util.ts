import { dropRight, last } from 'lodash';

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
  const firstField = frame.fields.at(0);

  const displayNameFromDS = firstField?.config?.displayNameFromDS;
  return displayNameFromDS ?? frame.name ?? firstField?.labels?.__name__;
};

const getSeriesValue = (frame: DataFrame) => {
  return frame.fields.at(0)?.values.at(0);
};

const smallNumberFormatter = new Intl.NumberFormat(undefined, {
  maximumSignificantDigits: 5,
});

const formatSeriesValue = (value: unknown): string => {
  if (Number.isFinite(value) && typeof value === 'number') {
    const absValue = Math.abs(value);
    if (absValue < 1) {
      return smallNumberFormatter.format(value);
    }
    return roundDecimals(value, 5).toString(10);
  }
  return String(value);
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

interface DecodedNamespace {
  name: string;
  parents: string[];
}

/**
 * After https://github.com/grafana/grafana/pull/74600,
 * Grafana folder names will be returned from the API as a combination of the folder name and parent UID in a format of JSON array,
 * where first element is parent UID and the second element is Title.
 *
 * Here we parse this to return the name of the last folder and the array of parent folders
 */
const decodeGrafanaNamespace = (namespace: CombinedRuleNamespace): DecodedNamespace => {
  const namespaceName = namespace.name;

  if (isCloudRulesSource(namespace.rulesSource)) {
    return {
      name: namespaceName,
      parents: [],
    };
  }

  // try to parse the folder as a nested folder, if it fails fall back to returning the folder name as-is.
  try {
    const folderParts: string[] = JSON.parse(namespaceName);
    if (!Array.isArray(folderParts)) {
      throw new Error('not a nested Grafana folder');
    }

    const name = last(folderParts) ?? namespaceName;
    const parents = dropRight(folderParts, 1);

    return {
      name,
      parents,
    };
  } catch {
    return {
      name: namespace.name,
      parents: [],
    };
  }
};

const encodeGrafanaNamespace = (name: string, parents: string[] | undefined = []) => {
  return JSON.stringify(parents.concat(name));
};

const isEmptySeries = (series: DataFrame[]): boolean => {
  const isEmpty = series.every((serie) => serie.fields.every((field) => field.values.every((value) => value == null)));

  return isEmpty;
};

export {
  decodeGrafanaNamespace,
  encodeGrafanaNamespace,
  formatLabels,
  getSeriesLabels,
  getSeriesName,
  getSeriesValue,
  formatSeriesValue,
  isEmptySeries,
};
