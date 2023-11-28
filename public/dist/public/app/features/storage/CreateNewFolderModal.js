import React from 'react';
import { Button, Field, Form, Input, Modal } from '@grafana/ui';
const initialFormModel = { folderName: '' };
export function CreateNewFolderModal({ validate, onDismiss, onSubmit }) {
    return (React.createElement(Modal, { onDismiss: onDismiss, isOpen: true, title: "New Folder" },
        React.createElement(Form, { defaultValues: initialFormModel, onSubmit: onSubmit, maxWidth: 'none' }, ({ register, errors }) => (React.createElement(React.Fragment, null,
            React.createElement(Field, { label: "Folder name", invalid: !!errors.folderName, error: errors.folderName && errors.folderName.message },
                React.createElement(Input, Object.assign({ id: "folder-name-input" }, register('folderName', {
                    required: 'Folder name is required.',
                    validate: { validate },
                })))),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { type: "submit" }, "Create")))))));
}
//# sourceMappingURL=CreateNewFolderModal.js.map