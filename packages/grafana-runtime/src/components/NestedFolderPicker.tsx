import * as React from 'react';

enum PermissionLevelString {
  View = 'View',
  Edit = 'Edit',
  Admin = 'Admin',
}

export interface NestedFolderPickerProps {
  /* Folder UID to show as selected */
  value?: string;

  /** Show an invalid state around the folder picker */
  invalid?: boolean;

  /* Whether to show the root 'Dashboards' (formally General) folder as selectable */
  showRootFolder?: boolean;

  /* Folder UIDs to exclude from the picker, to prevent invalid operations */
  excludeUIDs?: string[];

  /* Show folders matching this permission, mainly used to also show folders user can view. Defaults to showing only folders user has Edit  */
  permission?: PermissionLevelString.View | PermissionLevelString.Edit;

  /* Callback for when the user selects a folder */
  onChange?: (folderUID: string | undefined, folderName: string | undefined) => void;

  /* Whether the picker should be clearable */
  clearable?: boolean;
}

// let NestedFolderPicker: NestedFolderPickerType | null = null;

export type NestedFolderPickerType = React.ComponentType<NestedFolderPickerProps>;

/**
 * Used to bootstrap the NestedFolderPicker during application start
 * is exposed via runtime.
 *
 * @internal
 */
export function setNestedFolderPicker(component: NestedFolderPickerType) {
  NestedFolderPicker = component;
}

export let NestedFolderPicker: NestedFolderPickerType = (props) => {
  if (NestedFolderPicker) {
    return <NestedFolderPicker {...props} />;
  }
  return <div>Loading...</div>;
};
