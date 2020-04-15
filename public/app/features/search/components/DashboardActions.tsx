import React, { FC } from 'react';
import { HorizontalGroup } from '@grafana/ui';

export interface Props {
  folderId?: number;
  isEditor: boolean;
  canEdit: boolean;
}

export const DashboardActions: FC<Props> = ({ folderId, isEditor, canEdit }) => {
  const actionUrl = (type: string) => {
    let url = `dashboard/${type}`;

    if (folderId) {
      url += `?folderId=${folderId}`;
    }

    return url;
  };

  return (
    <HorizontalGroup spacing="md" align="center">
      {canEdit && (
        <a className="btn btn-primary" href={actionUrl('new')}>
          New Dashboard
        </a>
      )}
      {!folderId && isEditor && (
        <a className="btn btn-primary" href="dashboards/folder/new">
          New Folder
        </a>
      )}
      {canEdit && (
        <a className="btn btn-primary" href={actionUrl('import')}>
          Import
        </a>
      )}
    </HorizontalGroup>
  );
};
