import { SearchFilter } from '../dataquery.gen';

export const generateQueryFromFilters = (filters: SearchFilter[]) => {
  return `{${filters
    .filter((f) => f.tag && f.operator && f.value?.length)
    .map((f) => `${f.tag} ${f.operator} ${valueHelper(f)}`)
    .join(' && ')}}`;
};

const valueHelper = (f: SearchFilter) => {
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
