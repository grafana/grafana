import React, { FC, memo } from 'react';
import DashboardSearch from './DashboardSearch';
import { useLocation } from 'react-router-dom';
import { locationService } from '@grafana/runtime';

interface Props {
  folder?: string;
  queryText?: string;
  filter?: string;
}

export const SearchWrapper: FC<Props> = memo(({ folder }) => {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const isOpen = query.get('search') === 'open';

  const closeSearch = () => {
    if (isOpen) {
      locationService.partial({ search: null, folder: null });
    }
  };

  return isOpen ? <DashboardSearch onCloseSearch={closeSearch} folder={folder} /> : null;
});

SearchWrapper.displayName = 'SearchWrapper';
