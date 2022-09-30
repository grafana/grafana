import React, { FC } from 'react';

import { Card } from '@grafana/ui';
import { useGetAllWithFilters } from 'app/features/plugins/admin/state/hooks';

export const DataSourcePluginList: FC<{ searchTerm: string }> = ({ searchTerm }) => {
  const { isLoading, error, plugins } = useGetAllWithFilters({ query: searchTerm, filterBy: '' });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <>
      {plugins.map((plugin) => (
        <Card key={plugin.id}>{plugin.name}</Card>
      ))}
    </>
  );
};
