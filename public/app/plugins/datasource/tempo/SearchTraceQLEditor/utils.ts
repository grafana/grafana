import { SearchFilter } from '../dataquery.gen';

export const generateQueryFromFilters = (filters: SearchFilter[]) => {
  return `{${filters
    .filter((f) => f.value)
    .map((f) => `${f.tag} ${f.operator} ${!f.valueType || f.valueType === 'string' ? `"${f.value}"` : f.value}`)
    .join(' && ')}}`;
};

export function replaceAt<T>(array: T[], index: number, value: T) {
  const ret = array.slice(0);
  ret[index] = value;
  return ret;
}
