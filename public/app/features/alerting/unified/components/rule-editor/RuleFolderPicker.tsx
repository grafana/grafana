import React from 'react';

import { Props as FolderPickerProps } from 'app/core/components/Select/FolderPicker';
import { PermissionLevelString } from 'app/types';

import { FolderPickerWithAdd } from './FolderPickerWithAdd';

export interface Folder {
  title: string;
  id: number;
}

export interface RuleFolderPickerProps extends Omit<FolderPickerProps, 'initialTitle' | 'initialFolderId'> {
  value?: Folder;
  folderLabel: string;
  setFolderLabel: (label: string) => void;
}

export function RuleFolderPicker(props: RuleFolderPickerProps) {
  const { value, folderLabel, setFolderLabel } = props;
  return (
    <FolderPickerWithAdd
      showRoot={false}
      allowEmpty={true}
      initialTitle={value?.title}
      initialFolderId={value?.id}
      accessControlMetadata
      {...props}
      permissionLevel={PermissionLevelString.View}
      folderLabel={folderLabel}
      setFolderLabel={setFolderLabel}
    />
  );
}
