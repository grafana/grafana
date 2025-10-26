import { isArray, isEqual } from 'lodash';

import {
  LegacyMetricFindQueryOptions,
  ScopedVars,
  UrlQueryMap,
  UrlQueryValue,
  VariableType,
  VariableRefresh,
  VariableWithOptions,
  QueryVariableModel,
} from '@grafana/data';
import { getTemplateSrv, locationService } from '@grafana/runtime';
import { safeStringifyValue } from 'app/core/utils/explore';
import { StoreState } from 'app/types/store';

import { getState } from '../../store/store';
import { TimeSrv } from '../dashboard/services/TimeSrv';

import { variableAdapters } from './adapters';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE, VARIABLE_PREFIX } from './constants';
import { getVariablesState } from './state/selectors';
import { KeyedVariableIdentifier, VariableIdentifier, VariablePayload } from './state/types';
import { TransactionStatus, VariableModel } from './types';

/*
 * This regex matches 3 types of variable reference with an optional format specifier
 * There are 6 capture groups that replace will return
 * \$(\w+)                                    $var1
 * \[\[(\w+?)(?::(\w+))?\]\]                  [[var2]] or [[var2:fmt2]]
 * \${(\w+)(?:\.([^:^\}]+))?(?::([^\}]+))?}   ${var3} or ${var3.fieldPath} or ${var3:fmt3} (or ${var3.fieldPath:fmt3} but that is not a separate capture group)
 */
export const variableRegex = /\$(\w+)|\[\[(\w+?)(?::(\w+))?\]\]|\${(\w+)(?:\.([^:^\}]+))?(?::([^\}]+))?}/g;

// Helper function since lastIndex is not reset
export const variableRegexExec = (variableString: string) => {
  variableRegex.lastIndex = 0;
  return variableRegex.exec(variableString);
};

export function containsVariable(...args: any[]) {
  const variableName = args[args.length - 1];
  args[0] = typeof args[0] === 'string' ? args[0] : safeStringifyValue(args[0]);
  const variableString = args.slice(0, -1).join(' ');
  const matches = variableString.match(variableRegex);
  const isMatchingVariable =
    matches !== null
      ? matches.find((match) => {
          const varMatch = variableRegexExec(match);
          return varMatch !== null && varMatch.indexOf(variableName) > -1;
        })
      : false;

  return !!isMatchingVariable;
}

export const isAllVariable = (variable: any): boolean => {
  if (!variable) {
    return false;
  }

  if (!variable.current) {
    return false;
  }

  if (variable.current.value) {
    const isArray = Array.isArray(variable.current.value);
    if (isArray && variable.current.value.length && variable.current.value[0] === ALL_VARIABLE_VALUE) {
      return true;
    }

    if (!isArray && variable.current.value === ALL_VARIABLE_VALUE) {
      return true;
    }
  }

  if (variable.current.text) {
    const isArray = Array.isArray(variable.current.text);
    if (isArray && variable.current.text.length && variable.current.text[0] === ALL_VARIABLE_TEXT) {
      return true;
    }

    if (!isArray && variable.current.text === ALL_VARIABLE_TEXT) {
      return true;
    }
  }

  return false;
};

export const getCurrentText = (variable: any): string => {
  if (!variable) {
    return '';
  }

  if (!variable.current) {
    return '';
  }

  if (!variable.current.text) {
    return '';
  }

  if (Array.isArray(variable.current.text)) {
    return variable.current.text.toString();
  }

  if (typeof variable.current.text !== 'string') {
    return '';
  }

  return variable.current.text;
};

export const getCurrentValue = (variable: VariableWithOptions): string | null => {
  if (!variable || !variable.current || variable.current.value === undefined || variable.current.value === null) {
    return null;
  }

  if (Array.isArray(variable.current.value)) {
    return variable.current.value.toString();
  }

  if (typeof variable.current.value !== 'string') {
    return null;
  }

  return variable.current.value;
};

export function getTemplatedRegex(variable: QueryVariableModel, templateSrv = getTemplateSrv()): string {
  if (!variable) {
    return '';
  }

  if (!variable.regex) {
    return '';
  }

  return templateSrv.replace(variable.regex, {}, 'regex');
}

export function getLegacyQueryOptions(
  variable: QueryVariableModel,
  searchFilter: string | undefined,
  timeSrv: TimeSrv,
  scopedVars: ScopedVars | undefined
): LegacyMetricFindQueryOptions {
  const queryOptions: LegacyMetricFindQueryOptions = { range: undefined, variable, searchFilter, scopedVars };

  if (variable.refresh === VariableRefresh.onTimeRangeChanged || variable.refresh === VariableRefresh.onDashboardLoad) {
    queryOptions.range = timeSrv.timeRange();
  }

  return queryOptions;
}

export function getVariableRefresh(variable: VariableModel): VariableRefresh {
  if (variable?.type === 'custom') {
    return VariableRefresh.onDashboardLoad;
  }

  if (
    !variable ||
    !('refresh' in variable) ||
    (variable.refresh !== VariableRefresh.onTimeRangeChanged && variable.refresh !== VariableRefresh.onDashboardLoad)
  ) {
    return VariableRefresh.never;
  }

  return variable.refresh;
}

export function getVariableTypes(): Array<{ label: string; value: VariableType }> {
  return variableAdapters
    .list()
    .filter((v) => v.id !== 'system')
    .map(({ id, name, description }) => ({
      label: name,
      value: id,
      description,
    }));
}

function getUrlValueForComparison(value: unknown) {
  if (isArray(value)) {
    if (value.length === 0) {
      value = undefined;
    } else if (value.length === 1) {
      value = value[0];
    }
  }

  return value;
}

export interface UrlQueryType {
  value: UrlQueryValue;
  removed?: boolean;
}

export interface ExtendedUrlQueryMap extends Record<string, UrlQueryType> {}

export function findTemplateVarChanges(query: UrlQueryMap, old: UrlQueryMap): ExtendedUrlQueryMap | undefined {
  let count = 0;
  const changes: ExtendedUrlQueryMap = {};

  for (const key in query) {
    if (!key.startsWith(VARIABLE_PREFIX)) {
      continue;
    }

    let oldValue = getUrlValueForComparison(old[key]);
    let newValue = getUrlValueForComparison(query[key]);

    if (!isEqual(newValue, oldValue)) {
      changes[key] = { value: query[key] };
      count++;
    }
  }

  for (const key in old) {
    if (!key.startsWith(VARIABLE_PREFIX)) {
      continue;
    }

    const value = old[key];

    // ignore empty array values
    if (isArray(value) && value.length === 0) {
      continue;
    }

    if (!query.hasOwnProperty(key)) {
      changes[key] = { value: '', removed: true }; // removed
      count++;
    }
  }
  return count ? changes : undefined;
}

export function ensureStringValues(value: unknown | unknown[]): string | string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'number') {
    return value.toString(10);
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'boolean') {
    return value.toString();
  }

  return '';
}

export function hasOngoingTransaction(key: string, state: StoreState = getState()): boolean {
  return getVariablesState(key, state).transaction.status !== TransactionStatus.NotStarted;
}

export function toStateKey(key: string | null | undefined): string {
  return String(key);
}

export const toKeyedVariableIdentifier = (variable: VariableModel): KeyedVariableIdentifier => {
  if (!variable.rootStateKey) {
    throw new Error(`rootStateKey not found for variable with id:${variable.id}`);
  }

  return { type: variable.type, id: variable.id, rootStateKey: variable.rootStateKey };
};

export function toVariablePayload<T = undefined>(identifier: VariableIdentifier, data?: T): VariablePayload<T>;
export function toVariablePayload<T = undefined>(model: VariableModel, data?: T): VariablePayload<T>;
export function toVariablePayload<T = undefined>(
  obj: VariableIdentifier | VariableModel,
  data?: T
): VariablePayload<T> {
  return { type: obj.type, id: obj.id, data: data as T };
}

export function getVariablesFromUrl() {
  const variables = getTemplateSrv().getVariables();
  const queryParams = locationService.getSearchObject();

  return Object.keys(queryParams)
    .filter(
      (key) => key.indexOf(VARIABLE_PREFIX) !== -1 && variables.some((v) => v.name === key.replace(VARIABLE_PREFIX, ''))
    )
    .reduce<UrlQueryMap>((obj, key) => {
      const variableName = key.replace(VARIABLE_PREFIX, '');
      obj[variableName] = queryParams[key];

      return obj;
    }, {});
}
