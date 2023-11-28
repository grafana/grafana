import { css } from '@emotion/css';
import React from 'react';
import { Button, Modal } from '@grafana/ui';
import { SaveDashboardButton } from './SaveDashboardButton';
export const UnsavedChangesModal = ({ dashboard, onSaveSuccess, onDiscard, onDismiss }) => {
    return (React.createElement(Modal, { isOpen: true, title: "Unsaved changes", onDismiss: onDismiss, icon: "exclamation-triangle", className: css `
        width: 500px;
      ` },
        React.createElement("h5", null, "Do you want to save your changes?"),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(Button, { variant: "secondary", onClick: onDismiss, fill: "outline" }, "Cancel"),
            React.createElement(Button, { variant: "destructive", onClick: onDiscard }, "Discard"),
            React.createElement(SaveDashboardButton, { dashboard: dashboard, onSaveSuccess: onSaveSuccess }))));
};
//# sourceMappingURL=UnsavedChangesModal.js.map