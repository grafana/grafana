import React from 'react';
import { Icon, ModalsController } from '@grafana/ui';
import { RowOptionsModal } from './RowOptionsModal';
export const RowOptionsButton = ({ repeat, title, onUpdate, warning }) => {
    const onUpdateChange = (hideModal) => (title, repeat) => {
        onUpdate(title, repeat);
        hideModal();
    };
    return (React.createElement(ModalsController, null, ({ showModal, hideModal }) => {
        return (React.createElement("button", { type: "button", className: "pointer", "aria-label": "Row options", onClick: () => {
                showModal(RowOptionsModal, {
                    title,
                    repeat,
                    onDismiss: hideModal,
                    onUpdate: onUpdateChange(hideModal),
                    warning,
                });
            } },
            React.createElement(Icon, { name: "cog" })));
    }));
};
RowOptionsButton.displayName = 'RowOptionsButton';
//# sourceMappingURL=RowOptionsButton.js.map