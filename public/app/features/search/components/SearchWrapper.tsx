import React, { FC, memo } from 'react';
import DashboardSearch from './DashboardSearch';
import { useUrlParams } from 'app/core/navigation/hooks';

interface Props {
  folder?: string;
  queryText?: string;
  filter?: string;
}

export const SearchWrapper: FC<Props> = memo(({ folder }) => {
  const [params, updateUrlParams] = useUrlParams();
  const isOpen = params.get('search') === 'open';

  const closeSearch = () => {
    if (isOpen) {
      updateUrlParams({ search: null, folder: null });
    }
  };

  return isOpen ? <DashboardSearch onCloseSearch={closeSearch} folder={folder} /> : null;
});

SearchWrapper.displayName = 'SearchWrapper';
