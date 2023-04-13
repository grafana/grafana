import { isEqual, uniqWith } from 'lodash';

import { SelectableValue } from '@grafana/data';
import {
  AlertManagerCortexConfig,
  MatcherOperator,
  Route,
  Matcher,
  TimeInterval,
  TimeRange,
  ObjectMatcher,
} from 'app/plugins/datasource/alertmanager/types';
import { Labels } from 'app/types/unified-alerting-dto';

import { MatcherFieldValue } from '../types/silence-form';

import { getAllDataSources } from './config';
import { DataSourceType } from './datasource';

export function addDefaultsToAlertmanagerConfig(config: AlertManagerCortexConfig): AlertManagerCortexConfig {
  // add default receiver if it does not exist
  if (!config.alertmanager_config.receivers) {
    config.alertmanager_config.receivers = [{ name: 'default ' }];
  }
  // add default route if it does not exists
  if (!config.alertmanager_config.route) {
    config.alertmanager_config.route = {
      receiver: config.alertmanager_config.receivers![0].name,
    };
  }
  if (!config.template_files) {
    config.template_files = {};
  }
  return config;
}

export function removeMuteTimingFromRoute(muteTiming: string, route: Route): Route {
  const newRoute: Route = {
    ...route,
    mute_time_intervals: route.mute_time_intervals?.filter((muteName) => muteName !== muteTiming) ?? [],
    routes: route.routes?.map((subRoute) => removeMuteTimingFromRoute(muteTiming, subRoute)),
  };
  return newRoute;
}

export function renameMuteTimings(newMuteTimingName: string, oldMuteTimingName: string, route: Route): Route {
  return {
    ...route,
    mute_time_intervals: route.mute_time_intervals?.map((name) =>
      name === oldMuteTimingName ? newMuteTimingName : name
    ),
    routes: route.routes?.map((subRoute) => renameMuteTimings(newMuteTimingName, oldMuteTimingName, subRoute)),
  };
}

function isReceiverUsedInRoute(receiver: string, route: Route): boolean {
  return (
    (route.receiver === receiver || route.routes?.some((route) => isReceiverUsedInRoute(receiver, route))) ?? false
  );
}

export function isReceiverUsed(receiver: string, config: AlertManagerCortexConfig): boolean {
  return (
    (config.alertmanager_config.route && isReceiverUsedInRoute(receiver, config.alertmanager_config.route)) ?? false
  );
}

export function matcherToOperator(matcher: Matcher): MatcherOperator {
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

export function matcherOperatorToValue(operator: MatcherOperator) {
  switch (operator) {
    case MatcherOperator.equal:
      return { isEqual: true, isRegex: false };
    case MatcherOperator.notEqual:
      return { isEqual: false, isRegex: false };
    case MatcherOperator.regex:
      return { isEqual: true, isRegex: true };
    case MatcherOperator.notRegex:
      return { isEqual: false, isRegex: true };
  }
}

export function matcherToMatcherField(matcher: Matcher): MatcherFieldValue {
  return {
    name: matcher.name,
    value: matcher.value,
    operator: matcherToOperator(matcher),
  };
}

export function matcherFieldToMatcher(field: MatcherFieldValue): Matcher {
  return {
    name: field.name,
    value: field.value,
    ...matcherOperatorToValue(field.operator),
  };
}

export function matchersToString(matchers: Matcher[]) {
  const matcherFields = matchers.map(matcherToMatcherField);

  const combinedMatchers = matcherFields.reduce((acc, current) => {
    const currentMatcherString = `${current.name}${current.operator}"${current.value}"`;
    return acc ? `${acc},${currentMatcherString}` : currentMatcherString;
  }, '');

  return `{${combinedMatchers}}`;
}

export const matcherFieldOptions: SelectableValue[] = [
  { label: MatcherOperator.equal, description: 'Equals', value: MatcherOperator.equal },
  { label: MatcherOperator.notEqual, description: 'Does not equal', value: MatcherOperator.notEqual },
  { label: MatcherOperator.regex, description: 'Matches regex', value: MatcherOperator.regex },
  { label: MatcherOperator.notRegex, description: 'Does not match regex', value: MatcherOperator.notRegex },
];

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

export function matcherToObjectMatcher(matcher: Matcher): ObjectMatcher {
  const operator = matcherToOperator(matcher);
  return [matcher.name, operator, matcher.value];
}

export function parseMatchers(matcherQueryString: string): Matcher[] {
  const matcherRegExp = /\b([\w.-]+)(=~|!=|!~|=(?="?\w))"?([^"\n,} ]*)"?/g;
  const matchers: Matcher[] = [];

  matcherQueryString.replace(matcherRegExp, (_, key, operator, value) => {
    const isEqual = operator === MatcherOperator.equal || operator === MatcherOperator.regex;
    const isRegex = operator === MatcherOperator.regex || operator === MatcherOperator.notRegex;
    matchers.push({
      name: key,
      value: isRegex ? getValidRegexString(value.trim()) : value.trim(),
      isEqual,
      isRegex,
    });
    return '';
  });

  return matchers;
}

function getValidRegexString(regex: string): string {
  // Regexes provided by users might be invalid, so we need to catch the error
  try {
    new RegExp(regex);
    return regex;
  } catch (error) {
    return '';
  }
}

export function labelsMatchMatchers(labels: Labels, matchers: Matcher[]): boolean {
  return matchers.every(({ name, value, isRegex, isEqual }) => {
    return Object.entries(labels).some(([labelKey, labelValue]) => {
      const nameMatches = name === labelKey;
      let valueMatches;
      if (isEqual && !isRegex) {
        valueMatches = value === labelValue;
      }
      if (!isEqual && !isRegex) {
        valueMatches = value !== labelValue;
      }
      if (isEqual && isRegex) {
        valueMatches = new RegExp(value).test(labelValue);
      }
      if (!isEqual && isRegex) {
        valueMatches = !new RegExp(value).test(labelValue);
      }

      return nameMatches && valueMatches;
    });
  });
}

export function combineMatcherStrings(...matcherStrings: string[]): string {
  const matchers = matcherStrings.map(parseMatchers).flat();
  const uniqueMatchers = uniqWith(matchers, isEqual);
  return matchersToString(uniqueMatchers);
}

export function getAllAlertmanagerDataSources() {
  return getAllDataSources().filter((ds) => ds.type === DataSourceType.Alertmanager);
}

export function getAlertmanagerByUid(uid?: string) {
  return getAllAlertmanagerDataSources().find((ds) => uid === ds.uid);
}

export function timeIntervalToString(timeInterval: TimeInterval): string {
  const { times, weekdays, days_of_month, months, years } = timeInterval;
  const timeString = getTimeString(times);
  const weekdayString = getWeekdayString(weekdays);
  const daysString = getDaysOfMonthString(days_of_month);
  const monthsString = getMonthsString(months);
  const yearsString = getYearsString(years);

  return [timeString, weekdayString, daysString, monthsString, yearsString].join(', ');
}

export function getTimeString(times?: TimeRange[]): string {
  return (
    'Times: ' +
    (times ? times?.map(({ start_time, end_time }) => `${start_time} - ${end_time} UTC`).join(' and ') : 'All')
  );
}

export function getWeekdayString(weekdays?: string[]): string {
  return (
    'Weekdays: ' +
    (weekdays
      ?.map((day) => {
        if (day.includes(':')) {
          return day
            .split(':')
            .map((d) => {
              const abbreviated = d.slice(0, 3);
              return abbreviated[0].toLocaleUpperCase() + abbreviated.slice(1);
            })
            .join('-');
        } else {
          const abbreviated = day.slice(0, 3);
          return abbreviated[0].toLocaleUpperCase() + abbreviated.slice(1);
        }
      })
      .join(', ') ?? 'All')
  );
}

export function getDaysOfMonthString(daysOfMonth?: string[]): string {
  return 'Days of the month: ' + (daysOfMonth?.join(', ') ?? 'All');
}

export function getMonthsString(months?: string[]): string {
  return 'Months: ' + (months?.join(', ') ?? 'All');
}

export function getYearsString(years?: string[]): string {
  return 'Years: ' + (years?.join(', ') ?? 'All');
}
