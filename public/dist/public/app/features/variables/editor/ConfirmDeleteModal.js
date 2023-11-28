import { css } from '@emotion/css';
import React from 'react';
import { ConfirmModal } from '@grafana/ui';
export function ConfirmDeleteModal({ varName, isOpen = false, onConfirm, onDismiss }) {
    return (React.createElement(ConfirmModal, { title: "Delete variable", isOpen: isOpen, onConfirm: onConfirm, onDismiss: onDismiss, body: `
      Are you sure you want to delete variable "${varName}"?
    `, modalClass: styles.modal, confirmText: "Delete" }));
}
const styles = {
    modal: css({
        width: 'max-content',
        maxWidth: '80vw',
    }),
};
//# sourceMappingURL=ConfirmDeleteModal.js.map