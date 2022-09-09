import React, { FC } from 'react';

import { FolderPicker, Props as FolderPickerProps } from 'app/core/components/Select/FolderPicker';
import { AccessControlAction, PermissionLevelString } from 'app/types';

// @PERCONA
// Added uid here as optional
export interface Folder {
  title: string;
  id: number;
  uid?: number;
}

export interface RuleFolderPickerProps extends Omit<FolderPickerProps, 'initialTitle' | 'initialFolderId'> {
  value?: Folder;
  /** An empty array of permissions means no filtering at all */
  folderPermissions?: AccessControlAction[];
}

export const RuleFolderPicker: FC<RuleFolderPickerProps> = ({ value, ...props }) => {
  return (
    <FolderPicker
      showRoot={false}
      allowEmpty={true}
      initialTitle={value?.title}
      initialFolderId={value?.id}
      accessControlMetadata
      {...props}
      permissionLevel={PermissionLevelString.View}
    />
  );
};
