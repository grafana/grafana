import React, { useState } from 'react';

import { locationService } from '@grafana/runtime';
import { FilterInput, ToolbarButton, useTheme2 } from '@grafana/ui';
import { useMediaQueryChange } from 'app/core/hooks/useMediaQueryChange';
import { t } from 'app/core/internationalization';
import { useSearchQuery } from 'app/features/search/hooks/useSearchQuery';

export function TopSearchBarInput() {
  const theme = useTheme2();
  const { query, onQueryChange } = useSearchQuery({});
  const breakpoint = theme.breakpoints.values.sm;

  const [isSmallScreen, setIsSmallScreen] = useState(window.matchMedia(`(max-width: ${breakpoint}px)`).matches);

  useMediaQueryChange({
    breakpoint,
    onChange: (e) => {
      setIsSmallScreen(e.matches);
    },
  });

  const onOpenSearch = () => {
    locationService.partial({ search: 'open' });
  };

  const onSearchChange = (value: string) => {
    onQueryChange(value);
    if (value) {
      onOpenSearch();
    }
  };

  if (isSmallScreen) {
    return <ToolbarButton iconOnly icon="search" aria-label="Search Grafana" onClick={onOpenSearch} />;
  }

  return (
    <FilterInput
      onClick={onOpenSearch}
      placeholder={t('nav.search.placeholder', 'Search Grafana')}
      value={query.query ?? ''}
      onChange={onSearchChange}
    />
  );
}
