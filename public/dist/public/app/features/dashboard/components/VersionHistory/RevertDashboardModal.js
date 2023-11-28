import React, { useEffect } from 'react';
import { ConfirmModal } from '@grafana/ui';
import { useDashboardRestore } from './useDashboardRestore';
export const RevertDashboardModal = ({ hideModal, version }) => {
    // TODO: how should state.error be handled?
    const { state, onRestoreDashboard } = useDashboardRestore(version);
    useEffect(() => {
        if (!state.loading && state.value) {
            hideModal();
        }
    }, [state, hideModal]);
    return (React.createElement(ConfirmModal, { isOpen: true, title: "Restore Version", icon: "history", onDismiss: hideModal, onConfirm: onRestoreDashboard, body: React.createElement("p", null,
            "Are you sure you want to restore the dashboard to version ",
            version,
            "? All unsaved changes will be lost."), confirmText: `Yes, restore to version ${version}` }));
};
//# sourceMappingURL=RevertDashboardModal.js.map