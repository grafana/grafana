import { css } from '@emotion/css';
import React from 'react';
import { Button, Modal } from '@grafana/ui';
export const CorrelationUnsavedChangesModal = ({ onSave, onDiscard, onCancel }) => {
    return (React.createElement(Modal, { isOpen: true, title: "Unsaved changes to correlation", onDismiss: onCancel, icon: "exclamation-triangle", className: css({ width: '500px' }) },
        React.createElement("h5", null, "Do you want to save changes to this Correlation?"),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(Button, { variant: "secondary", onClick: onCancel, fill: "outline" }, "Cancel"),
            React.createElement(Button, { variant: "destructive", onClick: onDiscard }, "Discard correlation"),
            React.createElement(Button, { variant: "primary", onClick: onSave }, "Save correlation"))));
};
//# sourceMappingURL=CorrelationUnsavedChangesModal.js.map