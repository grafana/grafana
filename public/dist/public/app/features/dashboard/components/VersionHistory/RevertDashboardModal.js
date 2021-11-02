import React, { useEffect } from 'react';
import { ConfirmModal } from '@grafana/ui';
import { useDashboardRestore } from './useDashboardRestore';
export var RevertDashboardModal = function (_a) {
    var hideModal = _a.hideModal, version = _a.version;
    // TODO: how should state.error be handled?
    var _b = useDashboardRestore(version), state = _b.state, onRestoreDashboard = _b.onRestoreDashboard;
    useEffect(function () {
        if (state.loading === false && state.value) {
            hideModal();
        }
    }, [state, hideModal]);
    return (React.createElement(ConfirmModal, { isOpen: true, title: "Restore Version", icon: "history", onDismiss: hideModal, onConfirm: onRestoreDashboard, body: React.createElement("p", null,
            "Are you sure you want to restore the dashboard to version ",
            version,
            "? All unsaved changes will be lost."), confirmText: "Yes, restore to version " + version }));
};
//# sourceMappingURL=RevertDashboardModal.js.map