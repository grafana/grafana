import { AdHocVariableFilter } from 'app/features/variables/types';
import { UrlQueryValue } from '@grafana/data';
import { isArray, isString } from 'lodash';

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
    return values.map(toFilter).filter(isFilter);
  }

  const filter = toFilter(value);
  return filter === null ? [] : [filter];
};

function escapeDelimiter(value: string | undefined): string {
  return value?.replace(/\|/g, '__gfp__') ?? '';
}

function unescapeDelimiter(value: string | undefined): string {
  return value?.replace(/__gfp__/g, '|') ?? '';
}

function toArray(filter: AdHocVariableFilter): string[] {
  return [filter.key, filter.operator, filter.value];
}

function toFilter(value: string | number | boolean | undefined | null): AdHocVariableFilter | null {
  if (!isString(value) || value.length === 0) {
    return null;
  }

  const parts = value.split('|').map(unescapeDelimiter);

  return {
    key: parts[0],
    operator: parts[1],
    value: parts[2],
    condition: '',
  };
}

function isFilter(filter: AdHocVariableFilter | null): filter is AdHocVariableFilter {
  return filter !== null && isString(filter.value);
}
