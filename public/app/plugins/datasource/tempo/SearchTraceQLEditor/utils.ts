import { startCase, uniq } from 'lodash';

import { AdHocVariableFilter, ScopedVars, SelectableValue } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { VariableFormatID } from '@grafana/schema';

import { TraceqlFilter, TraceqlSearchScope } from '../dataquery.gen';
import { intrinsics } from '../traceql/traceql';
import { Scope } from '../types';

export const interpolateFilters = (filters: TraceqlFilter[], scopedVars?: ScopedVars) => {
  const interpolatedFilters = filters.map((filter) => {
    const updatedFilter = {
      ...filter,
      tag: getTemplateSrv().replace(filter.tag ?? '', scopedVars ?? {}),
    };

    if (filter.value) {
      updatedFilter.value =
        typeof filter.value === 'string'
          ? getTemplateSrv().replace(filter.value ?? '', scopedVars ?? {}, VariableFormatID.Pipe)
          : filter.value.map((v) => getTemplateSrv().replace(v ?? '', scopedVars ?? {}, VariableFormatID.Pipe));
    }

    return updatedFilter;
  });

  return interpolatedFilters;
};

export const generateQueryFromFilters = (filters: TraceqlFilter[]) => {
  if (!filters) {
    return '';
  }

  return `{${filters
    .filter((f) => f.tag && f.operator && f.value?.length)
    .map((f) => `${scopeHelper(f)}${tagHelper(f, filters)}${f.operator}${valueHelper(f)}`)
    .join(' && ')}}`;
};

const valueHelper = (f: TraceqlFilter) => {
  if (Array.isArray(f.value) && f.value.length > 1) {
    return `"${f.value.join('|')}"`;
  }
  if (f.valueType === 'string') {
    return `"${f.value}"`;
  }
  return f.value;
};

const scopeHelper = (f: TraceqlFilter) => {
  // Intrinsic fields don't have a scope
  if (intrinsics.find((t) => t === f.tag)) {
    return '';
  }
  return (
    (f.scope === TraceqlSearchScope.Resource || f.scope === TraceqlSearchScope.Span ? f.scope?.toLowerCase() : '') + '.'
  );
};

const tagHelper = (f: TraceqlFilter, filters: TraceqlFilter[]) => {
  if (f.tag === 'duration') {
    const durationType = filters.find((f) => f.id === 'duration-type');
    if (durationType) {
      return durationType.value === 'trace' ? 'traceDuration' : 'duration';
    }
    return f.tag;
  }
  return f.tag;
};

export const generateQueryFromAdHocFilters = (filters: AdHocVariableFilter[]) => {
  return `{${filters
    .filter((f) => f.key && f.operator && f.value)
    .map((f) => `${f.key}${f.operator}${adHocValueHelper(f)}`)
    .join(' && ')}}`;
};

const adHocValueHelper = (f: AdHocVariableFilter) => {
  if (intrinsics.find((t) => t === f.key)) {
    return f.value;
  }
  return `"${f.value}"`;
};

export const filterScopedTag = (f: TraceqlFilter) => {
  return scopeHelper(f) + f.tag;
};

export const filterTitle = (f: TraceqlFilter) => {
  // Special case for the intrinsic "name" since a label called "Name" isn't explicit
  if (f.tag === 'name') {
    return 'Span Name';
  }
  // Special case for the resource service name
  if (f.tag === 'service.name' && f.scope === TraceqlSearchScope.Resource) {
    return 'Service Name';
  }
  return startCase(filterScopedTag(f));
};

export const getFilteredTags = (tags: string[], staticTags: Array<string | undefined>) => {
  return [...intrinsics, ...tags].filter((t) => !staticTags.includes(t));
};

export const getUnscopedTags = (scopes: Scope[]) => {
  return uniq(
    scopes.map((scope: Scope) => (scope.name && scope.name !== 'intrinsic' && scope.tags ? scope.tags : [])).flat()
  );
};

export const getAllTags = (scopes: Scope[]) => {
  return uniq(scopes.map((scope: Scope) => (scope.tags ? scope.tags : [])).flat());
};

export const getTagsByScope = (scopes: Scope[], scope: TraceqlSearchScope | string) => {
  return uniq(scopes.map((s: Scope) => (s.name && s.name === scope && s.tags ? s.tags : [])).flat());
};

export function replaceAt<T>(array: T[], index: number, value: T) {
  const ret = array.slice(0);
  ret[index] = value;
  return ret;
}

export const operatorSelectableValue = (op: string) => {
  const result: SelectableValue = { label: op, value: op };
  switch (op) {
    case '=':
      result.description = 'Equals';
      break;
    case '!=':
      result.description = 'Not equals';
      break;
    case '>':
      result.description = 'Greater';
      break;
    case '>=':
      result.description = 'Greater or Equal';
      break;
    case '<':
      result.description = 'Less';
      break;
    case '<=':
      result.description = 'Less or Equal';
      break;
    case '=~':
      result.description = 'Matches regex';
      break;
    case '!~':
      result.description = 'Does not match regex';
      break;
  }
  return result;
};
