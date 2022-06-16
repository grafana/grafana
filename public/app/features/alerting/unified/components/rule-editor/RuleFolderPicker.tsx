import React, { FC } from 'react';

import { FolderPicker, Props as FolderPickerProps } from 'app/core/components/Select/FolderPicker';
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
