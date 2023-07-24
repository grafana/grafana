import React, { useCallback, useState } from 'react';

import { config } from '@grafana/runtime';

import { NestedFolderPicker, NestedFolderPickerProps } from '../NestedFolderPicker/NestedFolderPicker';

import { OldFolderPicker } from './OldFolderPicker';

// Temporary wrapper component to switch between the NestedFolderPicker and the old flat
// FolderPicker depending on feature flags
export function FolderPicker(props: NestedFolderPickerProps) {
  const nestedEnabled = config.featureToggles.nestedFolders && config.featureToggles.nestedFolderPicker;
  return nestedEnabled ? <NestedFolderPicker {...props} /> : <OldFolderPickerWrapper {...props} />;
}

// Converts new NestedFolderPicker props to old non-nested folder picker props
// Seperate component so the hooks aren't created if not used
function OldFolderPickerWrapper({ value, showRootFolder, onChange }: NestedFolderPickerProps) {
  const [initialFolderUID] = useState(value);
  const handleOnChange = useCallback(
    (newFolder: { title: string; uid: string }) => {
      if (onChange) {
        onChange(newFolder.uid, newFolder.title);
      }
    },
    [onChange]
  );

  return <OldFolderPicker onChange={handleOnChange} initialFolderUid={initialFolderUID} showRoot={showRootFolder} />;
}
