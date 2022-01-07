import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { Labels } from '@grafana/data';
import { parseMatcher } from './alertmanager';

// Parses a list of entries like like "['foo=bar', 'baz=~bad*']" into SilenceMatcher[]
export function parseQueryParamMatchers(matcherPairs: string[]): Matcher[] {
  return matcherPairs.filter((x) => !!x.trim()).map((x) => parseMatcher(x.trim()));
}

export const getMatcherQueryParams = (labels: Labels) => {
  return `matchers=${encodeURIComponent(
    Object.entries(labels)
      .filter(([labelKey]) => !(labelKey.startsWith('__') && labelKey.endsWith('__')))
      .map(([labelKey, labelValue]) => {
        return `${labelKey}=${labelValue}`;
      })
      .join(',')
  )}`;
};
