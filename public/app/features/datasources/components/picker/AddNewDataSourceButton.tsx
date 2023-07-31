import React from 'react';

import { LinkButton, ButtonVariant } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { ROUTES as CONNECTIONS_ROUTES } from 'app/features/connections/constants';
import { AccessControlAction } from 'app/types';

interface AddNewDataSourceButtonProps {
  onClick?: () => void;
  variant?: ButtonVariant;
}

export function AddNewDataSourceButton({ variant, onClick }: AddNewDataSourceButtonProps) {
  const hasCreateRights = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);
  const newDataSourceURL = CONNECTIONS_ROUTES.DataSourcesNew;

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
