import React from 'react';

import { LinkButton } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';

import { useDataSourcesRoutes } from '../state';

export function DataSourceAddButton() {
  const canCreateDataSource = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);
  const dataSourcesRoutes = useDataSourcesRoutes();

  return (
    <LinkButton icon="plus" href={dataSourcesRoutes.New} disabled={!canCreateDataSource}>
      Add new data source
    </LinkButton>
  );
}
