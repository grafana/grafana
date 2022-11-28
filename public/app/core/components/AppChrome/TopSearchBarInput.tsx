import React from 'react';

import { locationService } from '@grafana/runtime';
import { FilterInput } from '@grafana/ui';
import { useSearchQuery } from 'app/features/search/hooks/useSearchQuery';

export function TopSearchBarInput() {
  const { query, onQueryChange } = useSearchQuery({});

  const onOpenSearch = () => {
    locationService.partial({ search: 'open' });
  };

  const onSearchChange = (value: string) => {
    onQueryChange(value);
    if (value) {
      onOpenSearch();
    }
  };
  return (
    <FilterInput
      onClick={onOpenSearch}
      placeholder="Search Grafana"
      value={query.query ?? ''}
      onChange={onSearchChange}
    />
  );
}
