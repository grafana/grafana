import { isUndefined, omitBy } from 'lodash';

import { SelectableValue } from '@grafana/data';
import { MatcherOperator, Route } from 'app/plugins/datasource/alertmanager/types';

import { FormAmRoute } from '../types/amroutes';
import { MatcherFieldValue } from '../types/silence-form';

import { matcherToMatcherField, parseMatcher } from './alertmanager';
import { GRAFANA_RULES_SOURCE_NAME } from './datasource';
import { isValidPrometheusDuration } from './time';

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
  groupIntervalValue: '',
  repeatIntervalValue: '',
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
      overrideTimings: [route.group_wait, route.group_interval, route.repeat_interval].some(Boolean),
      groupWaitValue: route.group_wait ?? '',
      groupIntervalValue: route.group_interval ?? '',
      repeatIntervalValue: route.repeat_interval ?? '',
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

  const { overrideGrouping, groupBy, overrideTimings, groupWaitValue, groupIntervalValue, repeatIntervalValue } =
    formAmRoute;

  const group_by = overrideGrouping && groupBy ? groupBy : [];

  const overrideGroupWait = overrideTimings && groupWaitValue;
  const group_wait = overrideGroupWait ? groupWaitValue : undefined;

  const overrideGroupInterval = overrideTimings && groupIntervalValue;
  const group_interval = overrideGroupInterval ? groupIntervalValue : undefined;

  const overrideRepeatInterval = overrideTimings && repeatIntervalValue;
  const repeat_interval = overrideRepeatInterval ? repeatIntervalValue : undefined;

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

export function promDurationValidator(duration: string) {
  if (duration.length === 0) {
    return true;
  }

  return isValidPrometheusDuration(duration) || 'Invalid duration format. Must be {number}{time_unit}';
}
