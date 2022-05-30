import React, { FC, useCallback } from 'react';

import { FolderPicker, FolderPickerFilter, Props as FolderPickerProps } from 'app/core/components/Select/FolderPicker';
import { contextSrv } from 'app/core/services/context_srv';
import { DashboardSearchHit } from 'app/features/search/types';
import { AccessControlAction, PermissionLevelString } from 'app/types';

export interface Folder {
  title: string;
  id: number;
}

export interface RuleFolderPickerProps extends Omit<FolderPickerProps, 'initialTitle' | 'initialFolderId'> {
  value?: Folder;
  /** An empty array of permissions means no filtering at all */
  folderPermissions?: AccessControlAction[];
}

export const RuleFolderPicker: FC<RuleFolderPickerProps> = ({ value, folderPermissions = [], ...props }) => {
  const folderFilter = useFolderPermissionFilter(folderPermissions);

  return (
    <FolderPicker
      showRoot={false}
      allowEmpty={true}
      initialTitle={value?.title}
      initialFolderId={value?.id}
      filter={folderFilter}
      accessControlMetadata
      {...props}
      permissionLevel={PermissionLevelString.View}
    />
  );
};

const useFolderPermissionFilter = (permissions: AccessControlAction[]) => {
  const permissionFilter = getFolderPermissionFilter(permissions);
  return useCallback<FolderPickerFilter>(permissionFilter, [permissionFilter]);
};

function getFolderPermissionFilter(permissions: AccessControlAction[]): FolderPickerFilter {
  return (folderHits: DashboardSearchHit[]) => {
    return folderHits.filter((hit) =>
      permissions.every((permission) =>
        contextSrv.hasAccessInMetadata(permission, hit, contextSrv.hasEditPermissionInFolders)
      )
    );
  };
}
