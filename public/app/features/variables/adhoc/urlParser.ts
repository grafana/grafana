import { AdHocVariableFilter } from 'app/features/templating/variable';
import { UrlQueryValue } from '@grafana/runtime';
import { isString, isArray } from 'lodash';

export const toUrl = (filters: AdHocVariableFilter[]): string[] => {
  return filters.map(filter =>
    toArray(filter)
      .map(escapeDelimiter)
      .join('|')
  );
};

export const toFilters = (value: UrlQueryValue): AdHocVariableFilter[] => {
  if (isArray(value)) {
    const values = value as any[];
    return values.map(toFilter).filter(f => !!f);
  }

  const filter = toFilter(value);
  return !filter ? [] : [filter];
};

function escapeDelimiter(value: string) {
  return value.replace(/\|/g, '__gfp__');
}

function unescapeDelimiter(value: string) {
  return value.replace(/__gfp__/g, '|');
}

function toArray(filter: AdHocVariableFilter): string[] {
  return [filter.key, filter.operator, filter.value];
}

function toFilter(value: string | number | boolean | undefined | null): AdHocVariableFilter {
  if (!isString(value) || value.length === 0) {
    return undefined;
  }

  const parts = value.split('|').map(unescapeDelimiter);

  return {
    key: parts[0],
    operator: parts[1],
    value: parts[2],
    condition: '',
  };
}
