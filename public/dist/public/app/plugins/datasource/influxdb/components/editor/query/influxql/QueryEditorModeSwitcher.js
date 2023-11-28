import React, { useEffect, useState } from 'react';
import { Button, ConfirmModal } from '@grafana/ui';
export const QueryEditorModeSwitcher = ({ isRaw, onChange }) => {
    const [isModalOpen, setModalOpen] = useState(false);
    useEffect(() => {
        // if the isRaw changes, we hide the modal
        setModalOpen(false);
    }, [isRaw]);
    if (isRaw) {
        return (React.createElement(React.Fragment, null,
            React.createElement(Button, { "aria-label": "Switch to visual editor", icon: "pen", variant: "secondary", type: "button", onClick: () => {
                    // we show the are-you-sure modal
                    setModalOpen(true);
                } }),
            React.createElement(ConfirmModal, { isOpen: isModalOpen, title: "Switch to visual editor mode", body: "Are you sure to switch to visual editor mode? You will lose the changes done in raw query mode.", confirmText: "Yes, switch to editor mode", dismissText: "No, stay in raw query mode", onConfirm: () => {
                    onChange(false);
                }, onDismiss: () => {
                    setModalOpen(false);
                } })));
    }
    else {
        return (React.createElement(Button, { "aria-label": "Switch to text editor", icon: "pen", variant: "secondary", type: "button", onClick: () => {
                onChange(true);
            } }));
    }
};
//# sourceMappingURL=QueryEditorModeSwitcher.js.map