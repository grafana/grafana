import React from 'react';
import { ConfirmModal } from '@grafana/ui';
export var UnlinkModal = function (_a) {
    var isOpen = _a.isOpen, onConfirm = _a.onConfirm, onDismiss = _a.onDismiss;
    return (React.createElement(ConfirmModal, { title: "Do you really want to unlink this panel?", icon: "question-circle", body: "If you unlink this panel, you will be able to edit it without affecting any other dashboards.\n            However, once you make a change you will not be able to revert to its original reusable panel.", confirmText: "Yes, unlink", onConfirm: function () {
            onConfirm();
            onDismiss();
        }, onDismiss: onDismiss, isOpen: isOpen }));
};
//# sourceMappingURL=UnlinkModal.js.map