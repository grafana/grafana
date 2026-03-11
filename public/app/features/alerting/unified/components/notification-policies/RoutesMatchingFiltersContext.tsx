import { createContext, useContext } from 'react';

import { RoutesMatchingFilters } from './PoliciesTree';

const defaultValue: RoutesMatchingFilters = {
  filtersApplied: false,
  matchedRoutesWithPath: new Map(),
};

const RoutesMatchingFiltersContext = createContext<RoutesMatchingFilters>(defaultValue);

export const RoutesMatchingFiltersProvider = RoutesMatchingFiltersContext.Provider;

export function useRoutesMatchingFilters(): RoutesMatchingFilters {
  return useContext(RoutesMatchingFiltersContext);
}
