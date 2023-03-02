import { SelectableValue } from '@grafana/data';

import { TraceqlFilter } from '../dataquery.gen';

export const generateQueryFromFilters = (filters: TraceqlFilter[]) => {
  return `{${filters
    .filter((f) => f.tag && f.operator && f.value?.length)
    .map((f) => `${f.tag}${f.operator}${valueHelper(f)}`)
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
