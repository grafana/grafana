import { startCase } from 'lodash';

import { SelectableValue } from '@grafana/data';

import { TraceqlFilter, TraceqlSearchScope } from '../dataquery.gen';
import { CompletionProvider } from '../traceql/autocomplete';

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
  if (!f.valueType || f.valueType === 'string') {
    return `"${f.value}"`;
  }
  return f.value;
};
const scopeHelper = (f: TraceqlFilter) => {
  // Intrinsic fields don't have a scope
  if (CompletionProvider.intrinsics.find((t) => t === f.tag)) {
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
