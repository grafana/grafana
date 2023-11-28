import React from 'react';
import { ConfirmModal } from '@grafana/ui';
import { isPanelModelLibraryPanel } from '../../guard';
export const ChangeLibraryPanelModal = ({ onConfirm, onDismiss, panel }) => {
    const isLibraryPanel = isPanelModelLibraryPanel(panel);
    const title = `${isLibraryPanel ? 'Changing' : 'Replace with'} library panel`;
    const body = `${isLibraryPanel ? 'Changing' : 'Replacing with a'} library panel will remove any changes since last save.`;
    return (React.createElement(ConfirmModal, { onConfirm: onConfirm, onDismiss: onDismiss, confirmText: isLibraryPanel ? 'Change' : 'Replace', title: title, body: body, dismissText: "Cancel", isOpen: true }));
};
//# sourceMappingURL=ChangeLibraryPanelModal.js.map