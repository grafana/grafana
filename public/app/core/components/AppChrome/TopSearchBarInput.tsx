import { useKBar } from 'kbar';
import React, { useState } from 'react';

import { FilterInput, ToolbarButton, useTheme2 } from '@grafana/ui';
import { useMediaQueryChange } from 'app/core/hooks/useMediaQueryChange';
import { t } from 'app/core/internationalization';

export function TopSearchBarInput() {
  const theme = useTheme2();
  const { query: kbar } = useKBar();
  const breakpoint = theme.breakpoints.values.sm;

  const [isSmallScreen, setIsSmallScreen] = useState(window.matchMedia(`(max-width: ${breakpoint}px)`).matches);

  useMediaQueryChange({
    breakpoint,
    onChange: (e) => {
      setIsSmallScreen(e.matches);
    },
  });

  const onOpenSearch = () => {
    kbar.toggle();
  };

  const onSearchChange = (value: string) => {
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
      value={''}
      onChange={onSearchChange}
    />
  );
}
