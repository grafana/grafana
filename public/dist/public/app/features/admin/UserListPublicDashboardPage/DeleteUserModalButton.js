import { css } from '@emotion/css';
import React from 'react';
import { Button, Modal, ModalsController, useStyles2 } from '@grafana/ui/src';
const DeleteUserModal = ({ user, onDismiss }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement(Modal, { className: styles.modal, isOpen: true, title: "Delete", onDismiss: onDismiss },
        React.createElement("p", { className: styles.description },
            "The user ",
            user.email,
            " is currently present in ",
            user.totalDashboards,
            " public dashboard(s). If you wish to remove this user, please navigate to the settings of the corresponding public dashboard."),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(Button, { type: "button", variant: "secondary", onClick: onDismiss, fill: "outline" }, "Close"))));
};
export const DeleteUserModalButton = ({ user }) => (React.createElement(ModalsController, null, ({ showModal, hideModal }) => (React.createElement(Button, { size: "sm", variant: "destructive", onClick: () => showModal(DeleteUserModal, { user, onDismiss: hideModal }), icon: "times", "aria-label": "Delete user", title: "Delete user" }))));
const getStyles = (theme) => ({
    modal: css `
    width: 500px;
  `,
    description: css `
    font-size: ${theme.typography.body.fontSize};
    margin: 0;
  `,
});
//# sourceMappingURL=DeleteUserModalButton.js.map