import { Matcher, MatcherOperator } from 'app/plugins/datasource/alertmanager/types';
import { Labels } from '@grafana/data';
import { parseMatcher } from './alertmanager';
import { uniqBy } from 'lodash';
import { MatcherFieldValue } from '../types/silence-form';
import { CombinedRule } from 'app/types/unified-alerting';

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

interface MatchedRule {
  id: string;
  data: {
    matchedRule: CombinedRule;
  };
}

export const findAlertRulesWithMatchers = (rules: CombinedRule[], matchers: MatcherFieldValue[]): MatchedRule[] => {
  const hasMatcher = (rule: CombinedRule, matcher: MatcherFieldValue) => {
    return Object.entries(rule.labels).some(([key, value]) => {
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

  const filteredRules = rules.filter((rule) => {
    return matchers.every((matcher) => hasMatcher(rule, matcher));
  });
  const mappedRules = filteredRules.map((rule) => ({
    id: `${rule.namespace}-${rule.name}`,
    data: { matchedRule: rule },
  }));

  return mappedRules;
};
