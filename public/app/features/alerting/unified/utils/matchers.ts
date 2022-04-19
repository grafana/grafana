import { Matcher, MatcherOperator } from 'app/plugins/datasource/alertmanager/types';
import { Labels } from '@grafana/data';
import { parseMatcher } from './alertmanager';
import { uniqBy } from 'lodash';
import { MatcherFieldValue } from '../types/silence-form';
import { Alert } from 'app/types/unified-alerting';

// Parses a list of entries like like "['foo=bar', 'baz=~bad*']" into SilenceMatcher[]
export function parseQueryParamMatchers(matcherPairs: string[]): Matcher[] {
  const parsedMatchers = matcherPairs.filter((x) => !!x.trim()).map((x) => parseMatcher(x.trim()));

  // Due to migration, old alert rules might have a duplicated alertname label
  // To handle that case want to filter out duplicates and make sure there are only unique labels
  return uniqBy(parsedMatchers, (matcher) => matcher.name);
}

export const getMatcherQueryParams = (labels: Labels) => {
  const validMatcherLabels = Object.entries(labels).filter(
    ([labelKey]) => !(labelKey.startsWith('__') && labelKey.endsWith('__'))
  );

  const matcherUrlParams = new URLSearchParams();
  validMatcherLabels.forEach(([labelKey, labelValue]) =>
    matcherUrlParams.append('matcher', `${labelKey}=${labelValue}`)
  );

  return matcherUrlParams;
};

interface MatchedInstance {
  id: string;
  data: {
    matchedInstance: Alert;
  };
}

export const findAlertInstancesWithMatchers = (
  instances: Alert[],
  matchers: MatcherFieldValue[]
): MatchedInstance[] => {
  const hasMatcher = (instance: Alert, matcher: MatcherFieldValue) => {
    return Object.entries(instance.labels).some(([key, value]) => {
      if (!matcher.name || !matcher.value) {
        return false;
      }
      if (matcher.operator === MatcherOperator.equal) {
        return matcher.name === key && matcher.value === value;
      }
      if (matcher.operator === MatcherOperator.notEqual) {
        return matcher.name === key && matcher.value !== value;
      }
      if (matcher.operator === MatcherOperator.regex) {
        return matcher.name === key && matcher.value.match(value);
      }
      if (matcher.operator === MatcherOperator.notRegex) {
        return matcher.name === key && !matcher.value.match(value);
      }
      return false;
    });
  };

  const filteredInstances = instances.filter((instance) => {
    return matchers.every((matcher) => hasMatcher(instance, matcher));
  });
  const mappedInstances = filteredInstances.map((instance) => ({
    id: `${instance.activeAt}-${instance.value}`,
    data: { matchedInstance: instance },
  }));

  return mappedInstances;
};
