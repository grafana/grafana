import { type ScopedVars } from '../types/ScopedVars';

const SEARCH_FILTER_VARIABLE = '__searchFilter';

export const containsSearchFilter = (query: string | unknown): boolean =>
  query && typeof query === 'string' ? query.indexOf(SEARCH_FILTER_VARIABLE) !== -1 : false;

export interface SearchFilterOptions {
  searchFilter?: string;
  scopedVars?: ScopedVars;
}

export const getSearchFilterScopedVar = (args: {
  query: string;
  wildcardChar: string;
  options?: SearchFilterOptions;
}): ScopedVars => {
  const { query, wildcardChar } = args;
  const baseScopedVars = args.options?.scopedVars ?? {};

  if (!containsSearchFilter(query)) {
    return baseScopedVars;
  }

  let { options } = args;

  options = options || { searchFilter: '' };
  const value = options.searchFilter ? `${options.searchFilter}${wildcardChar}` : `${wildcardChar}`;

  return {
    ...baseScopedVars,
    __searchFilter: {
      value,
      text: '',
    },
  };
};
