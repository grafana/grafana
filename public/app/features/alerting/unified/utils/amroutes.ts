import { SelectableValue } from '@grafana/data';
import { Validate } from 'react-hook-form';
import { MatcherOperator, Route } from 'app/plugins/datasource/alertmanager/types';
import { FormAmRoute } from '../types/amroutes';
import { parseInterval, timeOptions } from './time';
import { isUndefined, omitBy } from 'lodash';
import { MatcherFieldValue } from '../types/silence-form';
import { matcherToMatcherField, parseMatcher } from './alertmanager';
import { GRAFANA_RULES_SOURCE_NAME } from './datasource';

const defaultValueAndType: [string, string] = ['', timeOptions[0].value];

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

const intervalToValueAndType = (strValue: string | undefined): [string, string] => {
  if (!strValue) {
    return defaultValueAndType;
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

export const emptyRoute: FormAmRoute = {
  id: '',
  groupBy: [],
  object_matchers: [],
  routes: [],
  continue: false,
  receiver: '',
  groupWaitValue: '',
  groupWaitValueType: timeOptions[0].value,
  groupIntervalValue: '',
  groupIntervalValueType: timeOptions[0].value,
  repeatIntervalValue: '',
  repeatIntervalValueType: timeOptions[0].value,
  muteTimeIntervals: [],
};

//returns route, and a record mapping id to existing route route
export const amRouteToFormAmRoute = (route: Route | undefined): [FormAmRoute, Record<string, Route>] => {
  if (!route || Object.keys(route).length === 0) {
    return [emptyRoute, {}];
  }

  const [groupWaitValue, groupWaitValueType] = intervalToValueAndType(route.group_wait);
  const [groupIntervalValue, groupIntervalValueType] = intervalToValueAndType(route.group_interval);
  const [repeatIntervalValue, repeatIntervalValueType] = intervalToValueAndType(route.repeat_interval);

  const id = String(Math.random());
  const id2route = {
    [id]: route,
  };
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
      groupBy: route.group_by ?? [],
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
  const amRoute: Route = {
    ...(existing ?? {}),
    continue: formAmRoute.continue,
    group_by: formAmRoute.groupBy,
    object_matchers: formAmRoute.object_matchers.length
      ? formAmRoute.object_matchers.map((matcher) => [matcher.name, matcher.operator, matcher.value])
      : undefined,
    match: undefined,
    match_re: undefined,
    group_wait: formAmRoute.groupWaitValue
      ? `${formAmRoute.groupWaitValue}${formAmRoute.groupWaitValueType}`
      : undefined,
    group_interval: formAmRoute.groupIntervalValue
      ? `${formAmRoute.groupIntervalValue}${formAmRoute.groupIntervalValueType}`
      : undefined,
    repeat_interval: formAmRoute.repeatIntervalValue
      ? `${formAmRoute.repeatIntervalValue}${formAmRoute.repeatIntervalValueType}`
      : undefined,
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
