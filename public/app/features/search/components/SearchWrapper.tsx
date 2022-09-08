import React, { FC, memo } from 'react';

import { config } from '@grafana/runtime';
import { useUrlParams } from 'app/core/navigation/hooks';

import { defaultQueryParams } from '../reducers/searchQueryReducer';

import { DashboardSearch } from './DashboardSearch';
import { DashboardSearchModal } from './DashboardSearchModal';

export const SearchWrapper: FC = memo(() => {
  const [params, updateUrlParams] = useUrlParams();
  const isOpen = params.get('search') === 'open';
  const isTopnav = config.featureToggles.topnav;

  const closeSearch = () => {
    if (isOpen) {
      updateUrlParams({
        search: null,
        folder: null,
        ...defaultQueryParams,
      });
    }
  };

  return isOpen ? (
    isTopnav ? (
      <DashboardSearchModal isOpen={isOpen} onCloseSearch={closeSearch} />
    ) : (
      // TODO: remove this component when we turn on the topnav feature toggle
      <DashboardSearch onCloseSearch={closeSearch} />
    )
  ) : null;
});

SearchWrapper.displayName = 'SearchWrapper';
