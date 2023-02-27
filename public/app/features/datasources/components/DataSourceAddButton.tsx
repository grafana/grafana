import React from 'react';

import { config } from '@grafana/runtime';
import { LinkButton } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';

import { useDataSourcesRoutes } from '../state';

export function DataSourceAddButton(): JSX.Element | null {
  const canCreateDataSource = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);
  const dataSourcesRoutes = useDataSourcesRoutes();

  return canCreateDataSource ? (
    <LinkButton icon="plus" href={config.appSubUrl + dataSourcesRoutes.New}>
      Add new data source
    </LinkButton>
  ) : null;
}
