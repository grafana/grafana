import React from 'react';

import { LinkButton, ButtonVariant } from '@grafana/ui';
import { config } from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { ROUTES as CONNECTIONS_ROUTES } from 'app/features/connections/constants';
import { DATASOURCES_ROUTES } from 'app/features/datasources/constants';
import { AccessControlAction } from 'app/types';

interface AddNewDataSourceButtonProps {
  onClick?: () => void;
  variant?: ButtonVariant;
}

export function AddNewDataSourceButton({ variant, onClick }: AddNewDataSourceButtonProps) {
  const hasCreateRights = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);
  const newDataSourceURL = config.featureToggles.dataConnectionsConsole
    ? CONNECTIONS_ROUTES.DataSourcesNew
    : DATASOURCES_ROUTES.New;

  return (
    <LinkButton
      variant={variant || 'primary'}
      href={newDataSourceURL}
      disabled={!hasCreateRights}
      tooltip={!hasCreateRights ? 'You do not have permission to configure new data sources' : undefined}
      onClick={onClick}
      target="_blank"
    >
      Configure a new data source
    </LinkButton>
  );
}
