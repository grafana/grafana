import { SelectableValue } from '@grafana/data';
import { Route } from 'app/plugins/datasource/alertmanager/types';
import { AmRouteFormValues } from '../types/amroutes';
import { parseInterval, timeOptions } from './time';

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
  receiver: undefined,
  groupWaitValue: '',
  groupWaitValueType: timeOptions[0],
  groupIntervalValue: '',
  groupIntervalValueType: timeOptions[0],
  repeatIntervalValue: '',
  repeatIntervalValueType: timeOptions[0],
};

const defaultValueAndType: [string, SelectableValue<string>] = ['', timeOptions[0]];

const getValueAndType = (
  route: Route,
  prop: 'group_wait' | 'group_interval' | 'repeat_interval'
): [string, SelectableValue<string>] => {
  if (!route[prop]) {
    return defaultValueAndType;
  }

  const [value, valueType] = route[prop] ? parseInterval(route[prop]!) : [undefined, undefined];

  return [String(value), timeOptions.find((opt) => opt.value === valueType)!];
};

export const computeDefaultValuesRoute = (route: Route | undefined): AmRouteFormValues => {
  if (!route || Object.keys(route).length === 0) {
    return emptyRoute;
  }

  const [groupWaitValue, groupWaitValueType] = getValueAndType(route, 'group_wait');
  const [groupIntervalValue, groupIntervalValueType] = getValueAndType(route, 'group_interval');
  const [repeatIntervalValue, repeatIntervalValueType] = getValueAndType(route, 'repeat_interval');

  return {
    matchers: [...computeMatchers(route.match, false), ...computeMatchers(route.match_re, true)],
    continue: route.continue ?? false,
    receiver: route.receiver ? mapStringToSelectableValue(route.receiver) : undefined,
    groupBy: mapStringsToSelectableValue(route.group_by),
    groupWaitValue,
    groupWaitValueType,
    groupIntervalValue,
    groupIntervalValueType,
    repeatIntervalValue,
    repeatIntervalValueType,
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

export const computeAlertManagerConfig = (data: AmRouteFormValues): Route => {
  return {
    receiver: data.receiver?.value,
    continue: data.continue,
    group_by: data.groupBy.map((groupBy) => groupBy.value),
    match: Object.values(data.matchers).reduce((acc, { label, value, isRegex }) => {
      if (!isRegex) {
        return {
          ...acc,
          [label]: value,
        };
      }

      return acc;
    }, {}),
    match_re: Object.values(data.matchers).reduce((acc, { label, value, isRegex }) => {
      if (isRegex) {
        return {
          ...acc,
          [label]: value,
        };
      }

      return acc;
    }, {}),
    group_wait: data.groupWaitValue ? `${data.groupWaitValue}${data.groupWaitValueType.value}` : undefined,
    group_interval: data.groupIntervalValue
      ? `${data.groupIntervalValue}${data.groupIntervalValueType.value}`
      : undefined,
    repeat_interval: data.repeatIntervalValue
      ? `${data.repeatIntervalValue}${data.repeatIntervalValueType.value}`
      : undefined,
    routes: data.routes.map(computeAlertManagerConfig),
  };
};
