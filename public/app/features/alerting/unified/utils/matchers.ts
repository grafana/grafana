/**
 * Functions in this file are used by the routeGroupsMatcher.worker.ts file.
 * This is a web worker that matches active alert instances to a policy in the notification policy tree.
 *
 * Please keep the references to other files here to a minimum, if we reference a file that uses GrafanaBootData from `window` the worker will fail to load.
 */

import { compact, uniqBy } from 'lodash';

import { Matcher, MatcherOperator, ObjectMatcher, Route } from 'app/plugins/datasource/alertmanager/types';

import { Labels } from '../../../../types/unified-alerting-dto';
import { MatcherFieldValue } from '../types/silence-form';

import { isPrivateLabelKey } from './labels';

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
 * 1. { foo=bar, bar=baz }
 * 2. foo=bar
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

  return parsePromQLStyleMatcherLoose(matcher);
}

/**
 * This function behaves the same as "parsePromQLStyleMatcher" but does not check if the matcher is formatted with { }
 * In other words; it accepts both "{ foo=bar, bar=baz }" and "foo=bar,bar=baz"
 * @throws
 */
export function parsePromQLStyleMatcherLoose(matcher: string): Matcher[] {
  // split by `,` but not when it's used as a label value
  const commaUnlessQuoted = /,(?=(?:[^"]*"[^"]*")*[^"]*$)/;
  const parts = matcher.replace(/^\{/, '').replace(/\}$/, '').trim().split(commaUnlessQuoted);

  return compact(parts)
    .flatMap(parseMatcher)
    .map((matcher) => ({
      ...matcher,
      name: unquoteWithUnescape(matcher.name),
      value: unquoteWithUnescape(matcher.value),
    }));
}

/**
 * This function behaves the same as "parsePromQLStyleMatcherLoose" but instead of throwing an error for incorrect syntax
 * it returns an empty Array of matchers instead.
 */
export function parsePromQLStyleMatcherLooseSafe(matcher: string): Matcher[] {
  try {
    return parsePromQLStyleMatcherLoose(matcher);
  } catch {
    return [];
  }
}

// Parses a list of entries like like "['foo=bar', 'baz=~bad*']" into SilenceMatcher[]
export function parseQueryParamMatchers(matcherPairs: string[]): Matcher[] {
  const parsedMatchers = matcherPairs.filter((x) => !!x.trim()).map((x) => parseMatcher(x));

  // Due to migration, old alert rules might have a duplicated alertname label
  // To handle that case want to filter out duplicates and make sure there are only unique labels
  return uniqBy(parsedMatchers, (matcher) => matcher.name);
}

export const getMatcherQueryParams = (labels: Labels) => {
  const validMatcherLabels = Object.entries(labels).filter(([labelKey]) => !isPrivateLabelKey(labelKey));

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
  let routeMatchers: ObjectMatcher[] = [];

  if (route.matchers) {
    route.matchers.forEach((matcher) => {
      const parsedMatchers = parseMatcherToArray(matcher).map(matcherToObjectMatcher);
      routeMatchers = routeMatchers.concat(parsedMatchers);
    });
  }

  if (route.object_matchers) {
    routeMatchers.push(...route.object_matchers);
  }

  if (route.match_re) {
    Object.entries(route.match_re).forEach(([label, value]) => {
      routeMatchers.push([label, MatcherOperator.regex, value]);
    });
  }

  if (route.match) {
    Object.entries(route.match).forEach(([label, value]) => {
      routeMatchers.push([label, MatcherOperator.equal, value]);
    });
  }

  return routeMatchers;
};

/**
 * Quotes string and escapes double quote and backslash characters
 */
export function quoteWithEscape(input: string) {
  const escaped = input.replace(/[\\"]/g, (c) => `\\${c}`);
  return `"${escaped}"`;
}

// The list of reserved characters that indicate we should be escaping the label key / value are
// { } ! = ~ , \ " ' ` and any whitespace (\s), encoded in the regular expression below
//
// See Alertmanager PR: https://github.com/prometheus/alertmanager/pull/3453
const RESERVED_CHARACTERS = /[\{\}\!\=\~\,\\\"\'\`\s]+/;

/**
 * Quotes string only when reserved characters are used
 */
export function quoteWithEscapeIfRequired(input: string) {
  const shouldQuote = RESERVED_CHARACTERS.test(input);
  return shouldQuote ? quoteWithEscape(input) : input;
}

export const encodeMatcher = ({ name, operator, value }: MatcherFieldValue) => {
  const encodedLabelName = quoteWithEscapeIfRequired(name);
  const encodedLabelValue = quoteWithEscape(value);

  return `${encodedLabelName}${operator}${encodedLabelValue}`;
};

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

export function isPromQLStyleMatcher(input: string): boolean {
  return input.startsWith('{') && input.endsWith('}');
}

export function matcherToObjectMatcher(matcher: Matcher): ObjectMatcher {
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
