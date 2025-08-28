import * as React from 'react';

interface FolderPickerProps {
  /* Folder UID to show as selected */
  value?: string;

  /** Show an invalid state around the folder picker */
  invalid?: boolean;

  /* Whether to show the root 'Dashboards' (formally General) folder as selectable */
  showRootFolder?: boolean;

  /* Folder UIDs to exclude from the picker, to prevent invalid operations */
  excludeUIDs?: string[];

  /* Start tree from this folder instead of root */
  rootFolderUID?: string;

  /* Custom root folder item, default is "Dashboards" */
  rootFolderItem?: string;

  /* Show folders matching this permission, mainly used to also show folders user can view. Defaults to showing only folders user has Edit  */
  permission?: 'view' | 'edit';

  /* Callback for when the user selects a folder */
  onChange?: (folderUID: string | undefined, folderName: string | undefined) => void;

  /* Whether the picker should be clearable */
  clearable?: boolean;
}

type FolderPickerComponentType = React.ComponentType<FolderPickerProps>;

let FolderPickerComponent: FolderPickerComponentType | undefined;

/**
 * Used to bootstrap the FolderPicker during application start
 *
 * @internal
 */
export function setFolderPicker(component: FolderPickerComponentType) {
  FolderPickerComponent = component;
}

export function FolderPicker(props: FolderPickerProps) {
  if (FolderPickerComponent) {
    return <FolderPickerComponent {...props} />;
  }

  if (process.env.NODE_ENV !== 'production') {
    return <div>@grafana/runtime FolderPicker is not set</div>;
  }

  return null;
}
