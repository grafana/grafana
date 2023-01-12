import { SearchFilterState } from '../search/searchParser';

export function getFilter(filter: Partial<SearchFilterState>): SearchFilterState {
  return {
    freeFormWords: [],
    labels: [],
    ...filter,
  };
}
