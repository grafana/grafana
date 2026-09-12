import { useMemo } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { locationSearchToObject } from '@grafana/runtime';
import { Sorters } from 'app/features/plugins/admin/helpers';

export interface ConnectionFilters {
  sortBy: Sorters;
  filterBy: string;
  groupBy: 'type' | 'category';
  categoryFilter: string;
  typeFilter: string;
}

export function useConnectionFiltersFromQuery(): ConnectionFilters {
  const location = useLocation();
  const locationSearch = locationSearchToObject(location.search);

  return useMemo(
    () => ({
      sortBy: (locationSearch.sortBy as unknown as Sorters) || Sorters.nameAsc, // eslint-disable-line @typescript-eslint/consistent-type-assertions
      filterBy: locationSearch.filterBy?.toString() || 'all',
      groupBy: (locationSearch.groupBy as unknown as 'type' | 'category') || 'type', // eslint-disable-line @typescript-eslint/consistent-type-assertions
      categoryFilter: locationSearch.categoryFilter?.toString() || 'all',
      typeFilter: locationSearch.typeFilter?.toString() || 'all',
    }),
    [locationSearch]
  );
}
