import React, { FC } from 'react';
import { FolderPicker, Props as FolderPickerProps } from 'app/core/components/Select/FolderPicker';

export interface Folder {
  title: string;
  id: number;
}

export interface Props extends Omit<FolderPickerProps, 'initialTitle' | 'initialFolderId'> {
  value?: Folder;
}

export const RuleFolderPicker: FC<Props> = ({ value, ...props }) => (
  <FolderPicker showRoot={false} allowEmpty={true} initialTitle={value?.title} initialFolderId={value?.id} {...props} />
);
