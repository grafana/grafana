import React from 'react';
import { ConfirmModal } from '@grafana/ui';
import { isPanelModelLibraryPanel } from '../../guard';
export var ChangeLibraryPanelModal = function (_a) {
    var onConfirm = _a.onConfirm, onDismiss = _a.onDismiss, panel = _a.panel;
    var isLibraryPanel = isPanelModelLibraryPanel(panel);
    var title = (isLibraryPanel ? 'Changing' : 'Replace with') + " library panel";
    var body = (isLibraryPanel ? 'Changing' : 'Replacing with a') + " library panel will remove any changes since last save.";
    return (React.createElement(ConfirmModal, { onConfirm: onConfirm, onDismiss: onDismiss, confirmText: isLibraryPanel ? 'Change' : 'Replace', title: title, body: body, dismissText: "Cancel", isOpen: true }));
};
//# sourceMappingURL=ChangeLibraryPanelModal.js.map