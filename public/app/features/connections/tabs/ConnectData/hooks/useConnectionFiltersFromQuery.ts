import { useMemo } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { locationSearchToObject } from '@grafana/runtime';
import { Sorters } from 'app/features/plugins/admin/helpers';

export interface ConnectionFilters {
  sortBy: Sorters;
  filterBy: string;
  groupBy: 'type' | 'category';
  categoryFilter: string[];
  typeFilter: string[];
}

// Multi-value filters are stored in the URL as a comma-separated list, with 'all' meaning no filter,
// so links created when these filters were single-select keep working.
function parseListFilter(value: unknown): string[] {
  const raw = value?.toString() ?? '';
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v !== '' && v !== 'all');
}

export function serializeListFilter(values: string[]): string {
  return values.length > 0 ? values.join(',') : 'all';
}

export function useConnectionFiltersFromQuery(): ConnectionFilters {
  const location = useLocation();
  const locationSearch = locationSearchToObject(location.search);

  return useMemo(
    () => ({
      sortBy: (locationSearch.sortBy as unknown as Sorters) || Sorters.nameAsc, // eslint-disable-line @typescript-eslint/consistent-type-assertions
      filterBy: locationSearch.filterBy?.toString() || 'all',
      groupBy: (locationSearch.groupBy as unknown as 'type' | 'category') || 'type', // eslint-disable-line @typescript-eslint/consistent-type-assertions
      categoryFilter: parseListFilter(locationSearch.categoryFilter),
      typeFilter: parseListFilter(locationSearch.typeFilter),
    }),
    [locationSearch]
  );
}
