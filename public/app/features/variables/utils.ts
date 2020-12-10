import isString from 'lodash/isString';
import { ScopedVars, VariableType } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { ALL_VARIABLE_TEXT } from './state/types';
import { QueryVariableModel, VariableModel, VariableRefresh } from './types';
import { getTimeSrv } from '../dashboard/services/TimeSrv';
import { variableAdapters } from './adapters';

/*
 * This regex matches 3 types of variable reference with an optional format specifier
 * \$(\w+)                          $var1
 * \[\[([\s\S]+?)(?::(\w+))?\]\]    [[var2]] or [[var2:fmt2]]
 * \${(\w+)(?::(\w+))?}             ${var3} or ${var3:fmt3}
 */
export const variableRegex = /\$(\w+)|\[\[([\s\S]+?)(?::(\w+))?\]\]|\${(\w+)(?:\.([^:^\}]+))?(?::([^\}]+))?}/g;

// Helper function since lastIndex is not reset
export const variableRegexExec = (variableString: string) => {
  variableRegex.lastIndex = 0;
  return variableRegex.exec(variableString);
};

export const SEARCH_FILTER_VARIABLE = '__searchFilter';

export const containsSearchFilter = (query: string | unknown): boolean =>
  query && typeof query === 'string' ? query.indexOf(SEARCH_FILTER_VARIABLE) !== -1 : false;

export const getSearchFilterScopedVar = (args: {
  query: string;
  wildcardChar: string;
  options: { searchFilter?: string };
}): ScopedVars => {
  const { query, wildcardChar } = args;
  if (!containsSearchFilter(query)) {
    return {};
  }

  let { options } = args;

  options = options || { searchFilter: '' };
  const value = options.searchFilter ? `${options.searchFilter}${wildcardChar}` : `${wildcardChar}`;

  return {
    __searchFilter: {
      value,
      text: '',
    },
  };
};

export function containsVariable(...args: any[]) {
  const variableName = args[args.length - 1];
  args[0] = isString(args[0]) ? args[0] : Object['values'](args[0]).join(' ');
  const variableString = args.slice(0, -1).join(' ');
  const matches = variableString.match(variableRegex);
  const isMatchingVariable =
    matches !== null
      ? matches.find(match => {
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

  if (!variable.current.text) {
    return false;
  }

  if (Array.isArray(variable.current.text)) {
    return variable.current.text.length ? variable.current.text[0] === ALL_VARIABLE_TEXT : false;
  }

  return variable.current.text === ALL_VARIABLE_TEXT;
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

export function getTemplatedRegex(variable: QueryVariableModel, templateSrv = getTemplateSrv()): string {
  if (!variable) {
    return '';
  }

  if (!variable.regex) {
    return '';
  }

  return templateSrv.replace(variable.regex, {}, 'regex');
}

export function getLegacyQueryOptions(variable: QueryVariableModel, searchFilter?: string, timeSrv = getTimeSrv()) {
  const queryOptions: any = { range: undefined, variable, searchFilter };
  if (variable.refresh === VariableRefresh.onTimeRangeChanged) {
    queryOptions.range = timeSrv.timeRange();
  }

  return queryOptions;
}

export function getVariableRefresh(variable: VariableModel): VariableRefresh {
  if (!variable || !variable.hasOwnProperty('refresh')) {
    return VariableRefresh.never;
  }

  const queryVariable = variable as QueryVariableModel;

  if (
    queryVariable.refresh !== VariableRefresh.onTimeRangeChanged &&
    queryVariable.refresh !== VariableRefresh.onDashboardLoad &&
    queryVariable.refresh !== VariableRefresh.never
  ) {
    return VariableRefresh.never;
  }

  return queryVariable.refresh;
}

export function getVariableTypes(): Array<{ label: string; value: VariableType }> {
  return variableAdapters
    .list()
    .filter(v => v.id !== 'system')
    .map(({ id, name }) => ({
      label: name,
      value: id,
    }));
}

export const getAllVariableValuesForUrl = (scopedVars?: ScopedVars) => {
  const params: Record<string, string | string[]> = {};
  const variables = getTemplateSrv().getVariables();

  for (let i = 0; i < variables.length; i++) {
    const variable = variables[i];
    if (scopedVars && scopedVars[variable.name] !== void 0) {
      if (scopedVars[variable.name].skipUrlSync) {
        continue;
      }
      params['var-' + variable.name] = scopedVars[variable.name].value;
    } else {
      // @ts-ignore
      if (variable.skipUrlSync) {
        continue;
      }
      params['var-' + variable.name] = variableAdapters.get(variable.type).getValueForUrl(variable as any);
    }
  }

  return params;
};
