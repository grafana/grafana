import { startCase, uniq } from 'lodash';

import { SelectableValue } from '@grafana/data';

import { TraceqlFilter, TraceqlSearchScope } from '../dataquery.gen';
import { intrinsics } from '../traceql/traceql';
import { Scope, Tags } from '../types';

export const generateQueryFromFilters = (filters: TraceqlFilter[]) => {
  return `{${filters
    .filter((f) => f.tag && f.operator && f.value?.length)
    .map((f) => `${scopeHelper(f)}${f.tag}${f.operator}${valueHelper(f)}`)
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

export const filterScopedTag = (f: TraceqlFilter) => {
  return scopeHelper(f) + f.tag;
};

export const filterTitle = (f: TraceqlFilter) => {
  // Special case for the intrinsic "name" since a label called "Name" isn't explicit
  if (f.tag === 'name') {
    return 'Span Name';
  }
  return startCase(filterScopedTag(f));
};

export const getFilteredTags = (tags: Tags | undefined, staticTags: Array<string | undefined>) => {
  let filteredTags;
  if (tags) {
    filteredTags = { ...tags };
    if (tags.v1) {
      filteredTags.v1 = [...intrinsics, ...tags.v1].filter((t) => !staticTags.includes(t));
    } else if (tags.v2) {
      filteredTags.v2 = tags.v2.map((scope: Scope) => {
        return {
          ...scope,
          tags: scope.tags ? [...intrinsics, ...scope.tags].filter((t) => !staticTags.includes(t)) : [],
        };
      });
    }
  }
  return filteredTags;
};

export const getUnscopedTags = (scopes: Scope[]) => {
  return uniq(
    scopes.map((scope: Scope) => (scope.name && scope.name !== 'intrinsic' && scope.tags ? scope.tags : [])).flat()
  );
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
