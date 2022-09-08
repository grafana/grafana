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
      const resetSearchParams = {
        search: null,
        folder: null,
        ...defaultQueryParams,
      };
      if (isTopnav) {
        delete resetSearchParams.query;
      }
      updateUrlParams(resetSearchParams);
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
