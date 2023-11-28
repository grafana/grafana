import { __rest } from "tslib";
import React, { useCallback } from 'react';
import { config } from '@grafana/runtime';
import { NestedFolderPicker } from '../NestedFolderPicker/NestedFolderPicker';
import { OldFolderPicker } from './OldFolderPicker';
// Temporary wrapper component to switch between the NestedFolderPicker and the old flat
// FolderPicker depending on feature flags
export function FolderPicker(props) {
    const nestedEnabled = config.featureToggles.nestedFolders && config.featureToggles.nestedFolderPicker;
    const { initialTitle, dashboardId, enableCreateNew } = props, newFolderPickerProps = __rest(props, ["initialTitle", "dashboardId", "enableCreateNew"]);
    return nestedEnabled ? React.createElement(NestedFolderPicker, Object.assign({}, newFolderPickerProps)) : React.createElement(OldFolderPickerWrapper, Object.assign({}, props));
}
// Converts new NestedFolderPicker props to old non-nested folder picker props
// Seperate component so the hooks aren't created if not used
function OldFolderPickerWrapper({ value, showRootFolder, onChange, initialTitle, dashboardId, enableCreateNew, inputId, skipInitialLoad, }) {
    const handleOnChange = useCallback((newFolder) => {
        if (onChange) {
            onChange(newFolder.uid, newFolder.title);
        }
    }, [onChange]);
    return (React.createElement(OldFolderPicker, { onChange: handleOnChange, showRoot: showRootFolder, initialFolderUid: value, initialTitle: initialTitle, inputId: inputId, skipInitialLoad: skipInitialLoad, dashboardId: dashboardId, enableCreateNew: enableCreateNew }));
}
//# sourceMappingURL=FolderPicker.js.map