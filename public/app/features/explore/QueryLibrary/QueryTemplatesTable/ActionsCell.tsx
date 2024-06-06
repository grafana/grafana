import React from 'react';

import { DataQuery } from '@grafana/schema';

import ExploreRunQueryButton from '../../ExploreRunQueryButton';

interface ActionsCellProps {
  query?: DataQuery;
  rootDatasourceUid?: string;
}

function ActionsCell({ query, rootDatasourceUid }: ActionsCellProps) {
  return <ExploreRunQueryButton queries={query ? [query] : []} rootDatasourceUid={rootDatasourceUid} />;
}

export default ActionsCell;
