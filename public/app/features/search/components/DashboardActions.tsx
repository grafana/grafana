import React, { FC } from 'react';

import { HorizontalGroup, LinkButton } from '@grafana/ui';

export interface Props {
  folderId?: number;
  canCreateFolders?: boolean;
  canCreateDashboards?: boolean;
}

export const DashboardActions: FC<Props> = ({ folderId, canCreateFolders = false, canCreateDashboards = false }) => {
  const actionUrl = (type: string) => {
    let url = `dashboard/${type}`;

    if (folderId) {
      url += `?folderId=${folderId}`;
    }

    return url;
  };

  return (
    <div>
      <HorizontalGroup spacing="md" align="center">
        {canCreateDashboards && <LinkButton href={actionUrl('new')}>New Dashboard</LinkButton>}
        {!folderId && canCreateFolders && <LinkButton href="dashboards/folder/new">New Folder</LinkButton>}
        {canCreateDashboards && <LinkButton href={actionUrl('import')}>Import</LinkButton>}
      </HorizontalGroup>
    </div>
  );
};
