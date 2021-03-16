import React, { FC, memo } from 'react';
import DashboardSearch from './DashboardSearch';
import { useUrlParams } from 'app/core/navigation/hooks';
import { defaultQueryParams } from '../reducers/searchQueryReducer';

export const SearchWrapper: FC = memo(() => {
  const [params, updateUrlParams] = useUrlParams();
  const isOpen = params.get('search') === 'open';

  const closeSearch = () => {
    if (isOpen) {
      updateUrlParams({ search: null, folder: null, ...defaultQueryParams });
    }
  };

  return isOpen ? <DashboardSearch onCloseSearch={closeSearch} /> : null;
});

SearchWrapper.displayName = 'SearchWrapper';
