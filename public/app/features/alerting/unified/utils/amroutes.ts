import { uniqueId } from 'lodash';

import { SelectableValue } from '@grafana/data';
import { MatcherOperator, ObjectMatcher, Route, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { FormAmRoute } from '../types/amroutes';
import { MatcherFieldValue } from '../types/silence-form';

import { matcherToMatcherField } from './alertmanager';
import { GRAFANA_RULES_SOURCE_NAME } from './datasource';
import { normalizeMatchers, parseMatcher } from './matchers';
import { findExistingRoute } from './routeTree';
import { isValidPrometheusDuration, safeParseDurationstr } from './time';

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

// add unique identifiers to each route in the route tree, that way we can figure out what route we've edited / deleted
export function addUniqueIdentifierToRoute(route: Route): RouteWithID {
  return {
    id: uniqueId('route-'),
    ...route,
    routes: (route.routes ?? []).map(addUniqueIdentifierToRoute),
  };
}

//returns route, and a record mapping id to existing route
export const amRouteToFormAmRoute = (route: RouteWithID | Route | undefined): FormAmRoute => {
  if (!route) {
    return emptyRoute;
  }

  const id = 'id' in route ? route.id : uniqueId('route-');

  if (Object.keys(route).length === 0) {
    const formAmRoute = { ...emptyRoute, id };
    return formAmRoute;
  }

  const formRoutes: FormAmRoute[] = [];
  route.routes?.forEach((subRoute) => {
    const subFormRoute = amRouteToFormAmRoute(subRoute);
    formRoutes.push(subFormRoute);
  });

  const objectMatchers =
    route.object_matchers?.map((matcher) => ({ name: matcher[0], operator: matcher[1], value: matcher[2] })) ?? [];
  const matchers = route.matchers?.map((matcher) => matcherToMatcherField(parseMatcher(matcher))) ?? [];

  return {
    id,
    // Frontend migration to use object_matchers instead of matchers, match, and match_re
    object_matchers: [
      ...matchers,
      ...objectMatchers,
      ...matchersToArrayFieldMatchers(route.match, false),
      ...matchersToArrayFieldMatchers(route.match_re, true),
    ],
    continue: route.continue ?? false,
    receiver: route.receiver ?? '',
    overrideGrouping: Array.isArray(route.group_by) && route.group_by.length > 0,
    groupBy: route.group_by ?? undefined,
    overrideTimings: [route.group_wait, route.group_interval, route.repeat_interval].some(Boolean),
    groupWaitValue: route.group_wait ?? '',
    groupIntervalValue: route.group_interval ?? '',
    repeatIntervalValue: route.repeat_interval ?? '',
    routes: formRoutes,
    muteTimeIntervals: route.mute_time_intervals ?? [],
  };
};

// convert a FormAmRoute to a Route
export const formAmRouteToAmRoute = (
  alertManagerSourceName: string,
  formAmRoute: Partial<FormAmRoute>,
  routeTree: RouteWithID
): Route => {
  const existing = findExistingRoute(formAmRoute.id ?? '', routeTree);

  const {
    overrideGrouping,
    groupBy,
    overrideTimings,
    groupWaitValue,
    groupIntervalValue,
    repeatIntervalValue,
    receiver,
  } = formAmRoute;

  // "undefined" means "inherit from the parent policy", currently supported by group_by, group_wait, group_interval, and repeat_interval
  const INHERIT_FROM_PARENT = undefined;

  const group_by = overrideGrouping ? groupBy : INHERIT_FROM_PARENT;

  const overrideGroupWait = overrideTimings && groupWaitValue;
  const group_wait = overrideGroupWait ? groupWaitValue : INHERIT_FROM_PARENT;

  const overrideGroupInterval = overrideTimings && groupIntervalValue;
  const group_interval = overrideGroupInterval ? groupIntervalValue : INHERIT_FROM_PARENT;

  const overrideRepeatInterval = overrideTimings && repeatIntervalValue;
  const repeat_interval = overrideRepeatInterval ? repeatIntervalValue : INHERIT_FROM_PARENT;
  const object_matchers = formAmRoute.object_matchers
    ?.filter((route) => route.name && route.value && route.operator)
    .map(({ name, operator, value }) => [name, operator, value] as ObjectMatcher);

  const routes = formAmRoute.routes?.map((subRoute) =>
    formAmRouteToAmRoute(alertManagerSourceName, subRoute, routeTree)
  );

  const amRoute: Route = {
    ...(existing ?? {}),
    continue: formAmRoute.continue,
    group_by: group_by,
    object_matchers: object_matchers,
    match: undefined, // DEPRECATED: Use matchers
    match_re: undefined, // DEPRECATED: Use matchers
    group_wait,
    group_interval,
    repeat_interval,
    routes: routes,
    mute_time_intervals: formAmRoute.muteTimeIntervals,
    receiver: receiver,
  };

  // non-Grafana managed rules should use "matchers", Grafana-managed rules should use "object_matchers"
  // Grafana maintains a fork of AM to support all utf-8 characters in the "object_matchers" property values but this
  // does not exist in upstream AlertManager
  if (alertManagerSourceName !== GRAFANA_RULES_SOURCE_NAME) {
    amRoute.matchers = formAmRoute.object_matchers?.map(({ name, operator, value }) => `${name}${operator}${value}`);
    amRoute.object_matchers = undefined;
  } else {
    amRoute.object_matchers = normalizeMatchers(amRoute);
    amRoute.matchers = undefined;
  }

  if (formAmRoute.receiver) {
    amRoute.receiver = formAmRoute.receiver;
  }

  return amRoute;
};

export const stringToSelectableValue = (str: string): SelectableValue<string> => ({
  label: str,
  value: str,
});

export const stringsToSelectableValues = (arr: string[] | undefined): Array<SelectableValue<string>> =>
  (arr ?? []).map(stringToSelectableValue);

export const mapSelectValueToString = (selectableValue: SelectableValue<string>): string | undefined => {
  // this allows us to deal with cleared values
  if (selectableValue === null) {
    return undefined;
  }

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

// function to convert ObjectMatchers to a array of strings
export const objectMatchersToString = (matchers: ObjectMatcher[]): string[] => {
  return matchers.map((matcher) => {
    const [name, operator, value] = matcher;
    return `${name}${operator}${value}`;
  });
};

export const repeatIntervalValidator = (repeatInterval: string, groupInterval: string) => {
  if (repeatInterval.length === 0) {
    return true;
  }

  const validRepeatInterval = promDurationValidator(repeatInterval);
  const validGroupInterval = promDurationValidator(groupInterval);

  if (validRepeatInterval !== true) {
    return validRepeatInterval;
  }

  if (validGroupInterval !== true) {
    return validGroupInterval;
  }

  const repeatDuration = safeParseDurationstr(repeatInterval);
  const groupDuration = safeParseDurationstr(groupInterval);

  const isRepeatLowerThanGroupDuration = groupDuration !== 0 && repeatDuration < groupDuration;

  return isRepeatLowerThanGroupDuration ? 'Repeat interval should be higher or equal to Group interval' : true;
};
