import React from 'react';

import { FolderPicker, Props as FolderPickerProps } from 'app/core/components/Select/FolderPicker';
import { PermissionLevelString } from 'app/types';

export interface Folder {
  title: string;
  id: number;
}

export interface RuleFolderPickerProps extends Omit<FolderPickerProps, 'initialTitle' | 'initialFolderId'> {
  value?: Folder;
}

export function RuleFolderPicker(props: RuleFolderPickerProps) {
  const { value } = props;
  return (
    <FolderPicker
      showRoot={false}
      allowEmpty={true}
      initialTitle={value?.title}
      initialFolderId={value?.id}
      accessControlMetadata
      {...props}
      permissionLevel={PermissionLevelString.View}
      customAdd={true}
    />
  );
}
