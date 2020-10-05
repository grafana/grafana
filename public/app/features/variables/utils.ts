import isString from 'lodash/isString';
import { ScopedVars } from '@grafana/data';
import { ALL_VARIABLE_TEXT } from './state/types';

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
