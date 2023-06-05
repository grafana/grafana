import { uniqBy } from 'lodash';

import { Matcher, MatcherOperator, ObjectMatcher, Route } from 'app/plugins/datasource/alertmanager/types';

import { Labels } from '../../../../types/unified-alerting-dto';

const matcherOperators = [
  MatcherOperator.regex,
  MatcherOperator.notRegex,
  MatcherOperator.notEqual,
  MatcherOperator.equal,
];

export function parseMatcher(matcher: string): Matcher {
  const trimmed = matcher.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    throw new Error(`PromQL matchers not supported yet, sorry! PromQL matcher found: ${trimmed}`);
  }
  const operatorsFound = matcherOperators
    .map((op): [MatcherOperator, number] => [op, trimmed.indexOf(op)])
    .filter(([_, idx]) => idx > -1)
    .sort((a, b) => a[1] - b[1]);

  if (!operatorsFound.length) {
    throw new Error(`Invalid matcher: ${trimmed}`);
  }
  const [operator, idx] = operatorsFound[0];
  const name = trimmed.slice(0, idx).trim();
  const value = trimmed.slice(idx + operator.length).trim();
  if (!name) {
    throw new Error(`Invalid matcher: ${trimmed}`);
  }

  return {
    name,
    value,
    isRegex: operator === MatcherOperator.regex || operator === MatcherOperator.notRegex,
    isEqual: operator === MatcherOperator.equal || operator === MatcherOperator.regex,
  };
}

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

/**
 * We need to deal with multiple (deprecated) properties such as "match" and "match_re"
 * this function will normalize all of the different ways to define matchers in to a single one.
 */
export const normalizeMatchers = (route: Route): ObjectMatcher[] => {
  const matchers: ObjectMatcher[] = [];

  if (route.matchers) {
    route.matchers.forEach((matcher) => {
      const { name, value, isEqual, isRegex } = parseMatcher(matcher);
      let operator = MatcherOperator.equal;

      if (isEqual && isRegex) {
        operator = MatcherOperator.regex;
      }
      if (!isEqual && isRegex) {
        operator = MatcherOperator.notRegex;
      }
      if (isEqual && !isRegex) {
        operator = MatcherOperator.equal;
      }
      if (!isEqual && !isRegex) {
        operator = MatcherOperator.notEqual;
      }

      matchers.push([name, operator, value]);
    });
  }

  if (route.object_matchers) {
    matchers.push(...route.object_matchers);
  }

  if (route.match_re) {
    Object.entries(route.match_re).forEach(([label, value]) => {
      matchers.push([label, MatcherOperator.regex, value]);
    });
  }

  if (route.match) {
    Object.entries(route.match).forEach(([label, value]) => {
      matchers.push([label, MatcherOperator.equal, value]);
    });
  }

  return matchers;
};

export type Label = [string, string];
type OperatorPredicate = (labelValue: string, matcherValue: string) => boolean;
const OperatorFunctions: Record<MatcherOperator, OperatorPredicate> = {
  [MatcherOperator.equal]: (lv, mv) => lv === mv,
  [MatcherOperator.notEqual]: (lv, mv) => lv !== mv,
  [MatcherOperator.regex]: (lv, mv) => new RegExp(mv).test(lv),
  [MatcherOperator.notRegex]: (lv, mv) => !new RegExp(mv).test(lv),
};

function isLabelMatch(matcher: ObjectMatcher, label: Label) {
  const [labelKey, labelValue] = label;
  const [matcherKey, operator, matcherValue] = matcher;

  // not interested, keys don't match
  if (labelKey !== matcherKey) {
    return false;
  }

  const matchFunction = OperatorFunctions[operator];
  if (!matchFunction) {
    throw new Error(`no such operator: ${operator}`);
  }

  return matchFunction(labelValue, matcherValue);
}

// check if every matcher returns "true" for the set of labels
export function labelsMatchObjectMatchers(matchers: ObjectMatcher[], labels: Label[]) {
  return matchers.every((matcher) => {
    return labels.some((label) => isLabelMatch(matcher, label));
  });
}
