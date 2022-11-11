import { isUndefined, omitBy } from 'lodash';
import { Validate } from 'react-hook-form';

import { SelectableValue } from '@grafana/data';
import { MatcherOperator, Route } from 'app/plugins/datasource/alertmanager/types';

import { FormAmRoute } from '../types/amroutes';
import { MatcherFieldValue } from '../types/silence-form';

import { matcherToMatcherField, parseMatcher } from './alertmanager';
import { GRAFANA_RULES_SOURCE_NAME } from './datasource';
import { parseInterval, timeOptions } from './time';

const defaultValueAndType: [string, string] = ['', ''];

const matchersToArrayFieldMatchers = (
  matchers: Record<string, string> | undefined,
  isRegex: boolean
): MatcherFieldValue[] =>
  Object.entries(matchers ?? {}).reduce<MatcherFieldValue[]>(
    (acc, [name, value]) => [
      ...acc,
      {
        name,
        value,
        operator: isRegex ? MatcherOperator.regex : MatcherOperator.equal,
      },
    ],
    [] as MatcherFieldValue[]
  );

const intervalToValueAndType = (
  strValue: string | undefined,
  defaultValue?: typeof defaultValueAndType
): [string, string] => {
  if (!strValue) {
    return defaultValue ?? defaultValueAndType;
  }

  const [value, valueType] = strValue ? parseInterval(strValue) : [undefined, undefined];

  const timeOption = timeOptions.find((opt) => opt.value === valueType);

  if (!value || !timeOption) {
    return defaultValueAndType;
  }

  return [String(value), timeOption.value];
};

const selectableValueToString = (selectableValue: SelectableValue<string>): string => selectableValue.value!;

const selectableValuesToStrings = (arr: Array<SelectableValue<string>> | undefined): string[] =>
  (arr ?? []).map(selectableValueToString);

export const emptyArrayFieldMatcher: MatcherFieldValue = {
  name: '',
  value: '',
  operator: MatcherOperator.equal,
};

// Default route group_by labels for newly created routes.
export const defaultGroupBy = ['grafana_folder', 'alertname'];

// Common route group_by options for multiselect drop-down
export const commonGroupByOptions = [
  { label: 'grafana_folder', value: 'grafana_folder' },
  { label: 'alertname', value: 'alertname' },
  { label: 'Disable (...)', value: '...' },
];

export const emptyRoute: FormAmRoute = {
  id: '',
  overrideGrouping: false,
  groupBy: defaultGroupBy,
  object_matchers: [],
  routes: [],
  continue: false,
  receiver: '',
  overrideTimings: false,
  groupWaitValue: '',
  groupWaitValueType: timeOptions[0].value,
  groupIntervalValue: '',
  groupIntervalValueType: timeOptions[0].value,
  repeatIntervalValue: '',
  repeatIntervalValueType: timeOptions[0].value,
  muteTimeIntervals: [],
};

//returns route, and a record mapping id to existing route
export const amRouteToFormAmRoute = (route: Route | undefined): [FormAmRoute, Record<string, Route>] => {
  if (!route) {
    return [emptyRoute, {}];
  }

  const id = String(Math.random());
  const id2route = {
    [id]: route,
  };

  if (Object.keys(route).length === 0) {
    const formAmRoute = { ...emptyRoute, id };
    return [formAmRoute, id2route];
  }

  const formRoutes: FormAmRoute[] = [];
  route.routes?.forEach((subRoute) => {
    const [subFormRoute, subId2Route] = amRouteToFormAmRoute(subRoute);
    formRoutes.push(subFormRoute);
    Object.assign(id2route, subId2Route);
  });

  // Frontend migration to use object_matchers instead of matchers
  const matchers = route.matchers
    ? route.matchers?.map((matcher) => matcherToMatcherField(parseMatcher(matcher))) ?? []
    : route.object_matchers?.map(
        (matcher) => ({ name: matcher[0], operator: matcher[1], value: matcher[2] } as MatcherFieldValue)
      ) ?? [];

  const [groupWaitValue, groupWaitValueType] = intervalToValueAndType(route.group_wait, ['', 's']);
  const [groupIntervalValue, groupIntervalValueType] = intervalToValueAndType(route.group_interval, ['', 'm']);
  const [repeatIntervalValue, repeatIntervalValueType] = intervalToValueAndType(route.repeat_interval, ['', 'h']);

  return [
    {
      id,
      object_matchers: [
        ...matchers,
        ...matchersToArrayFieldMatchers(route.match, false),
        ...matchersToArrayFieldMatchers(route.match_re, true),
      ],
      continue: route.continue ?? false,
      receiver: route.receiver ?? '',
      overrideGrouping: Array.isArray(route.group_by) && route.group_by.length !== 0,
      groupBy: route.group_by ?? [],
      overrideTimings: [groupWaitValue, groupIntervalValue, repeatIntervalValue].some(Boolean),
      groupWaitValue,
      groupWaitValueType,
      groupIntervalValue,
      groupIntervalValueType,
      repeatIntervalValue,
      repeatIntervalValueType,
      routes: formRoutes,
      muteTimeIntervals: route.mute_time_intervals ?? [],
    },
    id2route,
  ];
};

export const formAmRouteToAmRoute = (
  alertManagerSourceName: string | undefined,
  formAmRoute: FormAmRoute,
  id2ExistingRoute: Record<string, Route>
): Route => {
  const existing: Route | undefined = id2ExistingRoute[formAmRoute.id];

  const {
    overrideGrouping,
    groupBy,
    overrideTimings,
    groupWaitValue,
    groupWaitValueType,
    groupIntervalValue,
    groupIntervalValueType,
    repeatIntervalValue,
    repeatIntervalValueType,
  } = formAmRoute;

  const group_by = overrideGrouping && groupBy ? groupBy : [];

  const overrideGroupWait = overrideTimings && groupWaitValue;
  const group_wait = overrideGroupWait ? `${groupWaitValue}${groupWaitValueType}` : undefined;

  const overrideGroupInterval = overrideTimings && groupIntervalValue;
  const group_interval = overrideGroupInterval ? `${groupIntervalValue}${groupIntervalValueType}` : undefined;

  const overrideRepeatInterval = overrideTimings && repeatIntervalValue;
  const repeat_interval = overrideRepeatInterval ? `${repeatIntervalValue}${repeatIntervalValueType}` : undefined;

  const amRoute: Route = {
    ...(existing ?? {}),
    continue: formAmRoute.continue,
    group_by: group_by,
    object_matchers: formAmRoute.object_matchers.length
      ? formAmRoute.object_matchers.map((matcher) => [matcher.name, matcher.operator, matcher.value])
      : undefined,
    match: undefined, // DEPRECATED: Use matchers
    match_re: undefined, // DEPRECATED: Use matchers
    group_wait,
    group_interval,
    repeat_interval,
    routes: formAmRoute.routes.map((subRoute) =>
      formAmRouteToAmRoute(alertManagerSourceName, subRoute, id2ExistingRoute)
    ),
    mute_time_intervals: formAmRoute.muteTimeIntervals,
  };

  if (alertManagerSourceName !== GRAFANA_RULES_SOURCE_NAME) {
    amRoute.matchers = formAmRoute.object_matchers.map(({ name, operator, value }) => `${name}${operator}${value}`);
    amRoute.object_matchers = undefined;
  } else {
    amRoute.matchers = undefined;
  }

  if (formAmRoute.receiver) {
    amRoute.receiver = formAmRoute.receiver;
  }

  return omitBy(amRoute, isUndefined);
};

export const stringToSelectableValue = (str: string): SelectableValue<string> => ({
  label: str,
  value: str,
});

export const stringsToSelectableValues = (arr: string[] | undefined): Array<SelectableValue<string>> =>
  (arr ?? []).map(stringToSelectableValue);

export const mapSelectValueToString = (selectableValue: SelectableValue<string>): string => {
  if (!selectableValue) {
    return '';
  }

  return selectableValueToString(selectableValue) ?? '';
};

export const mapMultiSelectValueToStrings = (
  selectableValues: Array<SelectableValue<string>> | undefined
): string[] => {
  if (!selectableValues) {
    return [];
  }

  return selectableValuesToStrings(selectableValues);
};

export const optionalPositiveInteger: Validate<string> = (value) => {
  if (!value) {
    return undefined;
  }

  return !/^\d+$/.test(value) ? 'Must be a positive integer.' : undefined;
};
