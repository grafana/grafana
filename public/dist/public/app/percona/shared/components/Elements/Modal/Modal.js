import React, { useEffect } from 'react';
import { IconButton, useStyles2 } from '@grafana/ui';
import { getStyles } from './Modal.styles';
export const Modal = (props) => {
    const { isVisible, children, title, onClose, closeOnClickaway = true, closeOnEscape = true } = props;
    const styles = useStyles2(getStyles);
    useEffect(() => {
        if (closeOnEscape) {
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    onClose();
                }
            };
            document.addEventListener('keydown', escapeHandler);
            return () => document.removeEventListener('keydown', escapeHandler);
        }
        return undefined;
    }, [closeOnEscape, onClose]);
    return isVisible ? (React.createElement("div", { "data-testid": "modal-wrapper" },
        React.createElement("div", { className: styles.background, onClick: closeOnClickaway ? onClose : undefined, "data-testid": "modal-background" }),
        React.createElement("div", { className: styles.body, "data-testid": "modal-body" },
            React.createElement("div", { className: styles.modalHeader, "data-testid": "modal-header" },
                title,
                React.createElement("div", { className: styles.modalHeaderClose },
                    React.createElement(IconButton, { "data-testid": "modal-close-button", name: "times", size: "lg", onClick: onClose, "aria-label": "Close modal" }))),
            React.createElement("div", { className: styles.content, "data-testid": "modal-content" }, children)))) : null;
};
//# sourceMappingURL=Modal.js.map