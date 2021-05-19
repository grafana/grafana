import { SelectableValue } from '@grafana/data';
import { Validate } from 'react-hook-form';
import { Matcher, Route } from 'app/plugins/datasource/alertmanager/types';
import { FormAmRoute } from '../types/amroutes';
import { parseInterval, timeOptions } from './time';
import { parseMatcher, stringifyMatcher } from './alertmanager';

const defaultValueAndType: [string, string] = ['', timeOptions[0].value];

const matchersToArrayFieldMatchers = (matchers: Record<string, string> | undefined, isRegex: boolean): Matcher[] =>
  Object.entries(matchers ?? {}).reduce(
    (acc, [name, value]) => [
      ...acc,
      {
        name,
        value,
        isRegex: isRegex,
        isEqual: true,
      },
    ],
    []
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

export const emptyArrayFieldMatcher: Matcher = {
  name: '',
  value: '',
  isRegex: false,
  isEqual: true,
};

export const emptyRoute: FormAmRoute = {
  matchers: [emptyArrayFieldMatcher],
  groupBy: [],
  routes: [],
  continue: false,
  receiver: '',
  groupWaitValue: '',
  groupWaitValueType: timeOptions[0].value,
  groupIntervalValue: '',
  groupIntervalValueType: timeOptions[0].value,
  repeatIntervalValue: '',
  repeatIntervalValueType: timeOptions[0].value,
};

export const amRouteToFormAmRoute = (route: Route | undefined): FormAmRoute => {
  if (!route || Object.keys(route).length === 0) {
    return emptyRoute;
  }

  const [groupWaitValue, groupWaitValueType] = intervalToValueAndType(route.group_wait);
  const [groupIntervalValue, groupIntervalValueType] = intervalToValueAndType(route.group_interval);
  const [repeatIntervalValue, repeatIntervalValueType] = intervalToValueAndType(route.repeat_interval);

  return {
    matchers: [
      ...(route.matchers?.map(parseMatcher) ?? []),
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
    routes: (route.routes ?? []).map(amRouteToFormAmRoute),
  };
};

export const formAmRouteToAmRoute = (formAmRoute: FormAmRoute): Route => {
  const amRoute: Route = {
    continue: formAmRoute.continue,
    group_by: formAmRoute.groupBy,
    matchers: formAmRoute.matchers.length ? formAmRoute.matchers.map(stringifyMatcher) : undefined,
    group_wait: formAmRoute.groupWaitValue
      ? `${formAmRoute.groupWaitValue}${formAmRoute.groupWaitValueType}`
      : undefined,
    group_interval: formAmRoute.groupIntervalValue
      ? `${formAmRoute.groupIntervalValue}${formAmRoute.groupIntervalValueType}`
      : undefined,
    repeat_interval: formAmRoute.repeatIntervalValue
      ? `${formAmRoute.repeatIntervalValue}${formAmRoute.repeatIntervalValueType}`
      : undefined,
    routes: formAmRoute.routes.map(formAmRouteToAmRoute),
  };

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
