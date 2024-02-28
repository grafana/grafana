import React from 'react';

import { useListResourcesQuery } from '../api';

import { ResourcesTable } from './ResourcesTable';

export function ActiveState() {
  const { data: resources, isLoading } = useListResourcesQuery();

  if (isLoading || !resources) {
    return <div>Loading resources...</div>;
  }

  return (
    <div>
      <ResourcesTable resources={resources} />
    </div>
  );
}
