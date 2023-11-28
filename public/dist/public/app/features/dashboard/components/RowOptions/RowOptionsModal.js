import { css } from '@emotion/css';
import React from 'react';
import { Modal, stylesFactory } from '@grafana/ui';
import { RowOptionsForm } from './RowOptionsForm';
export const RowOptionsModal = ({ repeat, title, onDismiss, onUpdate, warning }) => {
    const styles = getStyles();
    return (React.createElement(Modal, { isOpen: true, title: "Row options", icon: "copy", onDismiss: onDismiss, className: styles.modal },
        React.createElement(RowOptionsForm, { repeat: repeat, title: title, onCancel: onDismiss, onUpdate: onUpdate, warning: warning })));
};
const getStyles = stylesFactory(() => {
    return {
        modal: css `
      label: RowOptionsModal;
      width: 500px;
    `,
    };
});
//# sourceMappingURL=RowOptionsModal.js.map