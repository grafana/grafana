import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { Labels } from '@grafana/data';
import { parseMatcher } from './alertmanager';

// Parses a list of entries like like "['foo=bar', 'baz=~bad*']" into SilenceMatcher[]
export function parseQueryParamMatchers(matcherPairs: string[]): Matcher[] {
  const parsedMatchers = matcherPairs.filter((x) => !!x.trim()).map((x) => parseMatcher(x.trim()));

  const uniqueMatchersMap = new Map<string, Matcher>();
  parsedMatchers.forEach(
    (matcher) => uniqueMatchersMap.has(matcher.name) === false && uniqueMatchersMap.set(matcher.name, matcher)
  );

  return Array.from(uniqueMatchersMap.values());
}

export const getMatcherQueryParams = (labels: Labels) => {
  const validMatcherLabels = Object.entries(labels).filter(
    ([labelKey]) => !(labelKey.startsWith('__') && labelKey.endsWith('__'))
  );

  var uniqueMatcherLabelPairs = new Map<string, string>();
  validMatcherLabels.forEach(
    ([labelKey, labelValue]) =>
      uniqueMatcherLabelPairs.has(labelKey) === false && uniqueMatcherLabelPairs.set(labelKey, labelValue)
  );

  const matcherUrlParams = new URLSearchParams();
  uniqueMatcherLabelPairs.forEach(([labekKey, labelValue]) => {
    matcherUrlParams.append('matchers', `${labekKey}=${labelValue}`);
  });

  return matcherUrlParams;
};
