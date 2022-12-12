import React, { FC } from 'react';

import { LinkButton } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';

import { useDataSourcesRoutes } from '../state';

export const DataSourceAddButton: FC = () => {
  const canCreateDataSource = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);
  const dataSourcesRoutes = useDataSourcesRoutes();

  return canCreateDataSource ? (
    <LinkButton icon="plus" href={dataSourcesRoutes.New}>
      Add new data source
    </LinkButton>
  ) : null;
};
