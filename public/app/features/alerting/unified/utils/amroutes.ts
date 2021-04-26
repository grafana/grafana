import { SelectableValue } from '@grafana/data';
import { Route } from 'app/plugins/datasource/alertmanager/types';
import { AmRouteFormValues } from '../types/amroutes';
import { parseInterval } from './time';

const computeMatchers = (matchers: Record<string, string> | undefined, isRegex: boolean) =>
  Object.entries(matchers ?? {}).reduce(
    (acc, [label, value]) => [
      ...acc,
      {
        label,
        value,
        isRegex: isRegex,
      },
    ],
    []
  );

export const emptyMatcher = {
  label: '',
  value: '',
  isRegex: false,
};

export const emptyRoute: AmRouteFormValues = {
  matchers: [],
  groupBy: [],
  routes: [],
  continue: false,
  receiver: '',
  groupWaitValue: '',
  groupWaitValueType: 's',
  groupIntervalValue: '',
  groupIntervalValueType: 's',
  repeatIntervalValue: '',
  repeatIntervalValueType: 's',
};

export const computeDefaultValuesRoute = (route: Route | undefined): AmRouteFormValues => {
  if (!route || Object.keys(route).length === 0) {
    return emptyRoute;
  }

  const [groupWaitValue, groupWaitValueType] = route.group_wait
    ? parseInterval(route.group_wait)
    : [undefined, undefined];

  const [groupIntervalValue, groupIntervalValueType] = route.group_interval
    ? parseInterval(route.group_interval)
    : [undefined, undefined];

  const [repeatIntervalValue, repeatIntervalValueType] = route.repeat_interval
    ? parseInterval(route.repeat_interval)
    : [undefined, undefined];

  return {
    matchers: [...computeMatchers(route.match, false), ...computeMatchers(route.match_re, true)],
    continue: route.continue ?? false,
    receiver: route.receiver ?? '',
    groupBy: mapStringsToSelectableValue(route.group_by),
    groupWaitValue: groupWaitValue ? String(groupWaitValue) : '',
    groupWaitValueType: groupWaitValueType ?? 's',
    groupIntervalValue: groupIntervalValue ? String(groupIntervalValue) : '',
    groupIntervalValueType: groupIntervalValueType ?? 's',
    repeatIntervalValue: repeatIntervalValue ? String(repeatIntervalValue) : '',
    repeatIntervalValueType: repeatIntervalValueType ?? 's',
    routes: (route.routes ?? []).map(computeDefaultValuesRoute),
  };
};

export const mapStringToSelectableValue = (str: string) => ({
  label: str,
  value: str,
});

export const mapStringsToSelectableValue = (arr: string[] | undefined) => (arr ?? []).map(mapStringToSelectableValue);

export const mapObjectsToSelectableValue = <T extends { [label: string]: any }>(
  arr: T[] | undefined,
  key: keyof T
): Array<SelectableValue<string>> =>
  (arr ?? []).map((obj) => ({
    label: obj[key],
    value: obj[key],
  }));

export const optionalPositiveInteger = (value: string) => {
  if (!value) {
    return undefined;
  }

  return !/^\d+$/.test(value) ? 'Must be a positive integer.' : undefined;
};
