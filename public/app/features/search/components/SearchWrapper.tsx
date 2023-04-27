import React, { memo } from 'react';

import { useUrlParams } from 'app/core/navigation/hooks';

import { DashboardSearchModal } from './DashboardSearchModal';

export const SearchWrapper = memo(() => {
  const [params] = useUrlParams();
  const isOpen = params.get('search') === 'open';

  return isOpen ? <DashboardSearchModal isOpen={isOpen} /> : null;
});

SearchWrapper.displayName = 'SearchWrapper';
