import React, { FC } from 'react';

import { Props as FolderPickerProps } from 'app/core/components/Select/FolderPicker';
import { PermissionLevelString } from 'app/types';

import { FolderPickerWithAdd } from './FolderPickerWithAdd';

export interface Folder {
  title: string;
  id: number;
}

export interface RuleFolderPickerProps extends Omit<FolderPickerProps, 'initialTitle' | 'initialFolderId'> {
  value?: Folder;
}

export const RuleFolderPicker: FC<RuleFolderPickerProps> = ({ value, ...props }) => {
  return (
    <FolderPickerWithAdd
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
