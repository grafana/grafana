import React from 'react';
import { Modal } from '@grafana/ui';
import AzureCheatSheet from '../AzureCheatSheet';
export const AzureCheatSheetModal = (props) => {
    const { isOpen, onClose, datasource, onChange } = props;
    return (React.createElement(Modal, { "aria-label": "Kick start your query modal", isOpen: isOpen, title: "Kick start your query", onDismiss: onClose },
        React.createElement(AzureCheatSheet, { onChange: (a) => {
                onChange(a);
                onClose();
            }, query: { refId: 'A' }, datasource: datasource })));
};
//# sourceMappingURL=AzureCheatSheetModal.js.map