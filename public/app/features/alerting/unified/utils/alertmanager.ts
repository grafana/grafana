import { isEqual, uniqWith } from 'lodash';

import { SelectableValue } from '@grafana/data';
import {
  AlertManagerCortexConfig,
  Matcher,
  MatcherOperator,
  ObjectMatcher,
  Route,
  TimeInterval,
  TimeRange,
} from 'app/plugins/datasource/alertmanager/types';
import { Labels } from 'app/types/unified-alerting-dto';

import { MatcherFieldValue } from '../types/silence-form';

import { getAllDataSources } from './config';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from './datasource';
import { objectLabelsToArray } from './labels';
import { MatcherFormatter, matchLabelsSet, parsePromQLStyleMatcherLooseSafe, unquoteWithUnescape } from './matchers';

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

export function removeTimeIntervalFromRoute(muteTiming: string, route: Route): Route {
  const newRoute: Route = {
    ...route,
    mute_time_intervals: route.mute_time_intervals?.filter((muteName) => muteName !== muteTiming) ?? [],
    active_time_intervals: route.active_time_intervals?.filter((muteName) => muteName !== muteTiming) ?? [],
    routes: route.routes?.map((subRoute) => removeTimeIntervalFromRoute(muteTiming, subRoute)),
  };
  return newRoute;
}

export function renameTimeInterval(newName: string, oldName: string, route: Route): Route {
  return {
    ...route,
    mute_time_intervals: route.mute_time_intervals?.map((name) => (name === oldName ? newName : name)),
    active_time_intervals: route.active_time_intervals?.map((name) => (name === oldName ? newName : name)),
    routes: route.routes?.map((subRoute) => renameTimeInterval(newName, oldName, subRoute)),
  };
}

export function unescapeObjectMatchers(matchers: ObjectMatcher[]): ObjectMatcher[] {
  return matchers.map(([name, operator, value]) => [name, operator, unquoteWithUnescape(value)]);
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
    return acc ? `${acc}, ${currentMatcherString}` : currentMatcherString;
  }, '');

  return `{ ${combinedMatchers} }`;
}

export const matcherFieldOptions: SelectableValue[] = [
  { label: MatcherOperator.equal, description: 'Equals', value: MatcherOperator.equal },
  { label: MatcherOperator.notEqual, description: 'Does not equal', value: MatcherOperator.notEqual },
  { label: MatcherOperator.regex, description: 'Matches regex', value: MatcherOperator.regex },
  { label: MatcherOperator.notRegex, description: 'Does not match regex', value: MatcherOperator.notRegex },
];

export function matcherToObjectMatcher(matcher: Matcher): ObjectMatcher {
  const operator = matcherToOperator(matcher);
  return [matcher.name, operator, matcher.value];
}

export function labelsMatchMatchers(labels: Labels, matchers: Matcher[]): boolean {
  const labelsArray = objectLabelsToArray(labels);
  const objectMatchers = matchers.map(matcherToObjectMatcher);

  return matchLabelsSet(objectMatchers, labelsArray);
}

export function combineMatcherStrings(...matcherStrings: string[]): string {
  const matchers = matcherStrings.map(parsePromQLStyleMatcherLooseSafe).flat();
  const uniqueMatchers = uniqWith(matchers, isEqual);
  return matchersToString(uniqueMatchers);
}

export function getAmMatcherFormatter(alertmanagerSourceName?: string): MatcherFormatter {
  return alertmanagerSourceName === GRAFANA_RULES_SOURCE_NAME ? 'default' : 'unquote';
}

export function getAllAlertmanagerDataSources() {
  return getAllDataSources().filter((ds) => ds.type === DataSourceType.Alertmanager);
}

export function getAlertmanagerByUid(uid?: string) {
  return getAllAlertmanagerDataSources().find((ds) => uid === ds.uid);
}

export function timeIntervalToString(timeInterval: TimeInterval): string {
  const { times, weekdays, days_of_month, months, years, location } = timeInterval;
  const timeString = getTimeString(times, location);
  const weekdayString = getWeekdayString(weekdays);
  const daysString = getDaysOfMonthString(days_of_month);
  const monthsString = getMonthsString(months);
  const yearsString = getYearsString(years);

  return [timeString, weekdayString, daysString, monthsString, yearsString].join(', ');
}

export function getTimeString(times?: TimeRange[], location?: string): string {
  return (
    'Times: ' +
    (times
      ? times?.map(({ start_time, end_time }) => `${start_time} - ${end_time} [${location ?? 'UTC'}]`).join(' and ')
      : 'All')
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
