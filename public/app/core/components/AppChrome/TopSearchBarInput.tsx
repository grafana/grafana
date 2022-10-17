import { useKBar } from 'kbar';
import React, { useState } from 'react';

import { Button, FilterInput, ToolbarButton, useTheme2 } from '@grafana/ui';
import { useMediaQueryChange } from 'app/core/hooks/useMediaQueryChange';
import { t } from 'app/core/internationalization';
import { useSearchQuery } from 'app/features/search/hooks/useSearchQuery';

export function TopSearchBarInput() {
  const { query: kbar, goToDashboardAction } = useKBar((state) => ({
    goToDashboardAction: state.actions['go/dashboard'],
  }));

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
    // locationService.partial({ search: 'open' });
    kbar.setCurrentRootAction(goToDashboardAction.id);
    kbar.toggle();
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
      suffix={
        <span>
          <Button variant="secondary" size="sm">
            ctrl
          </Button>{' '}
          <Button variant="secondary" size="sm">
            k
          </Button>
        </span>
      }
    />
  );
}
