/**
 * Functions in this file are used by the routeGroupsMatcher.worker.ts file.
 * This is a web worker that matches active alert instances to a policy in the notification policy tree.
 *
 * Please keep the references to other files here to a minimum, if we reference a file that uses GrafanaBootData from `window` the worker will fail to load.
 */

import { uniqBy } from 'lodash';

import { Matcher, MatcherOperator, ObjectMatcher, Route } from 'app/plugins/datasource/alertmanager/types';

import { Labels } from '../../../../types/unified-alerting-dto';

const matcherOperators = [
  MatcherOperator.regex,
  MatcherOperator.notRegex,
  MatcherOperator.notEqual,
  MatcherOperator.equal,
];

/**
 * Parse a single matcher, examples:
 *  foo="bar" => { name: foo, value: bar, isRegex: false, isEqual: true }
 *  bar!~baz => { name: bar, value: baz, isRegex: true, isEqual: false }
 */
export function parseMatcher(matcher: string): Matcher {
  if (matcher.startsWith('{') && matcher.endsWith('}')) {
    throw new Error(
      'this function does not support PromQL-style matcher syntax, call parsePromQLStyleMatcher() instead'
    );
  }

  const operatorsFound = matcherOperators
    .map((op): [MatcherOperator, number] => [op, matcher.indexOf(op)])
    .filter(([_, idx]) => idx > -1)
    .sort((a, b) => a[1] - b[1]);

  if (!operatorsFound.length) {
    throw new Error(`Invalid matcher: ${matcher}`);
  }
  const [operator, idx] = operatorsFound[0];
  const name = matcher.slice(0, idx).trim();
  const value = matcher.slice(idx + operator.length);
  if (!name) {
    throw new Error(`Invalid matcher: ${matcher}`);
  }

  return {
    name,
    value,
    isRegex: operator === MatcherOperator.regex || operator === MatcherOperator.notRegex,
    isEqual: operator === MatcherOperator.equal || operator === MatcherOperator.regex,
  };
}

/**
 * This function combines parseMatcher and parsePromQLStyleMatcher, always returning an array of Matcher[] regardless of input syntax
 */
export function parseMatcherToArray(matcher: string): Matcher[] {
  return isPromQLStyleMatcher(matcher) ? parsePromQLStyleMatcher(matcher) : [parseMatcher(matcher)];
}

/**
 * This function turns a PromQL-style matchers like { foo="bar", bar!=baz } in to an array of Matchers
 */
export function parsePromQLStyleMatcher(matcher: string): Matcher[] {
  if (!isPromQLStyleMatcher(matcher)) {
    throw new Error('not a PromQL style matcher');
  }

  return matcher
    .replace(/^\{/, '')
    .replace(/\}$/, '')
    .trim()
    .split(',')
    .flatMap(parseMatcher)
    .map((matcher) => ({
      ...matcher,
      name: unquoteWithUnescape(matcher.name),
      value: unquoteWithUnescape(matcher.value),
    }));
}

// Parses a list of entries like like "['foo=bar', 'baz=~bad*']" into SilenceMatcher[]
export function parseQueryParamMatchers(matcherPairs: string[]): Matcher[] {
  const parsedMatchers = matcherPairs.filter((x) => !!x.trim()).map((x) => parseMatcher(x));

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
  let matchers: ObjectMatcher[] = [];

  if (route.matchers) {
    route.matchers.forEach((matcher) => {
      const parsedMatchers = parseMatcherToArray(matcher).map(matcherToObjectMatcher);
      matchers = matchers.concat(parsedMatchers);
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

/**
 * Quotes string and escapes double quote and backslash characters
 */
export function quoteWithEscape(input: string) {
  const escaped = input.replace(/[\\"]/g, (c) => `\\${c}`);
  return `"${escaped}"`;
}

/**
 * Unquotes and unescapes a string **if it has been quoted**
 */
export function unquoteWithUnescape(input: string) {
  if (!/^"(.*)"$/.test(input)) {
    return input;
  }

  return input
    .replace(/^"(.*)"$/, '$1')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

export const matcherFormatter = {
  default: ([name, operator, value]: ObjectMatcher): string => {
    // Value can be an empty string which we want to display as ""
    const formattedValue = value || '';
    return `${name} ${operator} ${formattedValue}`;
  },
  unquote: ([name, operator, value]: ObjectMatcher): string => {
    const unquotedName = unquoteWithUnescape(name);
    // Unquoted value can be an empty string which we want to display as ""
    const unquotedValue = unquoteWithUnescape(value) || '""';
    return `${unquotedName} ${operator} ${unquotedValue}`;
  },
} as const;

function isPromQLStyleMatcher(input: string): boolean {
  return input.startsWith('{') && input.endsWith('}');
}

function matcherToObjectMatcher(matcher: Matcher): ObjectMatcher {
  const operator = matcherToOperator(matcher);
  return [matcher.name, operator, matcher.value];
}

function matcherToOperator(matcher: Matcher): MatcherOperator {
  if (matcher.isEqual) {
    if (matcher.isRegex) {
      return MatcherOperator.regex;
    } else {
      return MatcherOperator.equal;
    }
  } else if (matcher.isRegex) {
    return MatcherOperator.notRegex;
  } else {
    return MatcherOperator.notEqual;
  }
}

export type MatcherFormatter = keyof typeof matcherFormatter;

export type Label = [string, string];
