import { css } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import React, { createRef, useState } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { Button, useStyles2 } from '@grafana/ui';
import { config } from 'app/core/config';
import { PickerTabType } from '../types';
import { FileUploader } from './FileUploader';
import { FolderPickerTab } from './FolderPickerTab';
import { URLPickerTab } from './URLPickerTab';
export const ResourcePickerPopover = (props) => {
    const { value, onChange, mediaType, folderName } = props;
    const styles = useStyles2(getStyles);
    const onClose = () => {
        onChange(value);
    };
    const ref = createRef();
    const { dialogProps } = useDialog({}, ref);
    const { overlayProps } = useOverlay({ onClose, isDismissable: true, isOpen: true }, ref);
    const isURL = value && value.includes('://');
    const [newValue, setNewValue] = useState(value !== null && value !== void 0 ? value : '');
    const [activePicker, setActivePicker] = useState(isURL ? PickerTabType.URL : PickerTabType.Folder);
    const [formData, setFormData] = useState(new FormData());
    const [upload, setUpload] = useState(false);
    const [error, setError] = useState({ message: '' });
    const getTabClassName = (tabName) => {
        return `${styles.resourcePickerPopoverTab} ${activePicker === tabName && styles.resourcePickerPopoverActiveTab}`;
    };
    const renderFolderPicker = () => (React.createElement(FolderPickerTab, { value: value, mediaType: mediaType, folderName: folderName, newValue: newValue, setNewValue: setNewValue }));
    const renderURLPicker = () => React.createElement(URLPickerTab, { newValue: newValue, setNewValue: setNewValue, mediaType: mediaType });
    const renderUploader = () => (React.createElement(FileUploader, { mediaType: mediaType, setFormData: setFormData, setUpload: setUpload, newValue: newValue, error: error }));
    const renderPicker = () => {
        switch (activePicker) {
            case PickerTabType.Folder:
                return renderFolderPicker();
            case PickerTabType.URL:
                return renderURLPicker();
            case PickerTabType.Upload:
                return renderUploader();
            default:
                return renderFolderPicker();
        }
    };
    return (React.createElement(FocusScope, { contain: true, autoFocus: true, restoreFocus: true },
        React.createElement("section", Object.assign({ ref: ref }, overlayProps, dialogProps),
            React.createElement("div", { className: styles.resourcePickerPopover },
                React.createElement("div", { className: styles.resourcePickerPopoverTabs },
                    React.createElement("button", { className: getTabClassName(PickerTabType.Folder), onClick: () => setActivePicker(PickerTabType.Folder) }, "Folder"),
                    React.createElement("button", { className: getTabClassName(PickerTabType.URL), onClick: () => setActivePicker(PickerTabType.URL) }, "URL")),
                React.createElement("div", { className: styles.resourcePickerPopoverContent },
                    renderPicker(),
                    React.createElement("div", { className: styles.buttonRow },
                        React.createElement(Button, { variant: 'secondary', onClick: () => onClose(), fill: "outline" }, "Cancel"),
                        React.createElement(Button, { variant: newValue && newValue !== value ? 'primary' : 'secondary', onClick: () => {
                                if (upload) {
                                    fetch('/api/storage/upload', {
                                        method: 'POST',
                                        body: formData,
                                    })
                                        .then((res) => {
                                        if (res.status >= 400) {
                                            res.json().then((data) => setError(data));
                                            return;
                                        }
                                        else {
                                            return res.json();
                                        }
                                    })
                                        .then((data) => {
                                        getBackendSrv()
                                            .get(`api/storage/read/${data.path}`)
                                            .then(() => setNewValue(`${config.appUrl}api/storage/read/${data.path}`))
                                            .then(() => onChange(`${config.appUrl}api/storage/read/${data.path}`));
                                    })
                                        .catch((err) => console.error(err));
                                }
                                else {
                                    onChange(newValue);
                                }
                            } }, "Select")))))));
};
const getStyles = (theme) => ({
    resourcePickerPopover: css `
    border-radius: ${theme.shape.radius.default};
    box-shadow: ${theme.shadows.z3};
    background: ${theme.colors.background.primary};
    border: 1px solid ${theme.colors.border.weak};
  `,
    resourcePickerPopoverTab: css `
    width: 50%;
    text-align: center;
    padding: ${theme.spacing(1, 0)};
    background: ${theme.colors.background.secondary};
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
    cursor: pointer;
    border: none;

    &:focus:not(:focus-visible) {
      outline: none;
      box-shadow: none;
    }

    :focus-visible {
      position: relative;
    }
  `,
    resourcePickerPopoverActiveTab: css `
    color: ${theme.colors.text.primary};
    font-weight: ${theme.typography.fontWeightMedium};
    background: ${theme.colors.background.primary};
  `,
    resourcePickerPopoverContent: css `
    width: 315px;
    font-size: ${theme.typography.bodySmall.fontSize};
    min-height: 184px;
    padding: ${theme.spacing(1)};
    display: flex;
    flex-direction: column;
  `,
    resourcePickerPopoverTabs: css `
    display: flex;
    width: 100%;
    border-radius: ${theme.shape.radius.default} ${theme.shape.radius.default} 0 0;
  `,
    buttonRow: css({
        display: 'flex',
        justifyContent: 'center',
        gap: theme.spacing(2),
        padding: theme.spacing(1),
    }),
});
//# sourceMappingURL=ResourcePickerPopover.js.map