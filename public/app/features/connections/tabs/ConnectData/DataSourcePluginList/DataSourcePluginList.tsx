import React, { FC } from 'react';

import { useGetAllWithFilters } from 'app/features/plugins/admin/state/hooks';

import { CardGrid } from '../CardGrid';

export const DataSourcePluginList: FC<{ searchTerm: string }> = ({ searchTerm }) => {
  const { isLoading, error, plugins } = useGetAllWithFilters({ query: searchTerm, filterBy: '' });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return <CardGrid plugins={plugins} />;
};
