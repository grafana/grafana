import React, { useRef, useEffect } from 'react';
import { Button, Icon, Modal } from '@grafana/ui';
export function ConfirmModal({ isOpen, onCancel, onDiscard, onCopy }) {
    const buttonRef = useRef(null);
    // Moved from grafana/ui
    useEffect(() => {
        var _a;
        // for some reason autoFocus property did no work on this button, but this does
        if (isOpen) {
            (_a = buttonRef.current) === null || _a === void 0 ? void 0 : _a.focus();
        }
    }, [isOpen]);
    return (React.createElement(Modal, { title: React.createElement("div", { className: "modal-header-title" },
            React.createElement(Icon, { name: "exclamation-triangle", size: "lg" }),
            React.createElement("span", { className: "p-l-1" }, "Warning")), onDismiss: onCancel, isOpen: isOpen },
        React.createElement("p", null, "Builder mode does not display changes made in code. The query builder will display the last changes you made in builder mode."),
        React.createElement("p", null, "Do you want to copy your code to the clipboard?"),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(Button, { type: "button", variant: "secondary", onClick: onCancel, fill: "outline" }, "Cancel"),
            React.createElement(Button, { variant: "destructive", type: "button", onClick: onDiscard, ref: buttonRef }, "Discard code and switch"),
            React.createElement(Button, { variant: "primary", onClick: onCopy }, "Copy code and switch"))));
}
//# sourceMappingURL=ConfirmModal.js.map