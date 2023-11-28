import { css } from '@emotion/css';
import React from 'react';
import { ConfirmModal, useStyles2 } from '@grafana/ui/src';
const Body = ({ title }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("p", { className: styles.description }, title
        ? 'Are you sure you want to revoke this URL? The dashboard will no longer be public.'
        : 'Orphaned public dashboard will no longer be public.'));
};
export const DeletePublicDashboardModal = ({ dashboardTitle, onConfirm, onDismiss, }) => (React.createElement(ConfirmModal, { isOpen: true, body: React.createElement(Body, { title: dashboardTitle }), onConfirm: onConfirm, onDismiss: onDismiss, title: "Revoke public URL", icon: "trash-alt", confirmText: "Revoke public URL" }));
const getStyles = (theme) => ({
    title: css `
    margin-bottom: ${theme.spacing(1)};
  `,
    description: css `
    font-size: ${theme.typography.body.fontSize};
  `,
});
//# sourceMappingURL=DeletePublicDashboardModal.js.map