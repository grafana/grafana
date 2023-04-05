import { uniqBy } from 'lodash';

import { Labels } from '@grafana/data';
import { Matcher, MatcherOperator } from 'app/plugins/datasource/alertmanager/types';
import { Alert } from 'app/types/unified-alerting';

import { MatcherFieldValue } from '../types/silence-form';

import { parseMatcher } from './alertmanager';

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

// TODO We can probably remove this as filtering is done in the backend
export const findAlertInstancesWithMatchers = (
  instances: Alert[],
  matchers: MatcherFieldValue[]
): MatchedInstance[] => {
  const anchorRegex = (regexpString: string): RegExp => {
    // Silence matchers are always fully anchored in the Alertmanager: https://github.com/prometheus/alertmanager/pull/748
    if (!regexpString.startsWith('^')) {
      regexpString = '^' + regexpString;
    }
    if (!regexpString.endsWith('$')) {
      regexpString = regexpString + '$';
    }
    return new RegExp(regexpString);
  };

  const matchesInstance = (instance: Alert, matcher: MatcherFieldValue) => {
    return Object.entries(instance.labels).some(([key, value]) => {
      if (!matcher.name || !matcher.value) {
        return false;
      }
      if (matcher.name !== key) {
        return false;
      }
      switch (matcher.operator) {
        case MatcherOperator.equal:
          return matcher.value === value;
        case MatcherOperator.notEqual:
          return matcher.value !== value;
        case MatcherOperator.regex:
          const regex = anchorRegex(matcher.value);
          return regex.test(value);
        case MatcherOperator.notRegex:
          const negregex = anchorRegex(matcher.value);
          return !negregex.test(value);
        default:
          return false;
      }
    });
  };

  const filteredInstances = instances.filter((instance) => {
    return matchers.every((matcher) => matchesInstance(instance, matcher));
  });
  const mappedInstances = filteredInstances.map((instance) => ({
    id: `${instance.activeAt}-${instance.value}`,
    data: { matchedInstance: instance },
  }));

  return mappedInstances;
};
