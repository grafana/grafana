import { __rest } from "tslib";
import React from 'react';
import { Button, ModalsController } from '@grafana/ui/src';
import { useDeletePublicDashboardMutation } from 'app/features/dashboard/api/publicDashboardApi';
import { DeletePublicDashboardModal } from './DeletePublicDashboardModal';
export const DeletePublicDashboardButton = (_a) => {
    var { dashboard, publicDashboard, loader, children, onDismiss } = _a, rest = __rest(_a, ["dashboard", "publicDashboard", "loader", "children", "onDismiss"]);
    const [deletePublicDashboard, { isLoading }] = useDeletePublicDashboardMutation();
    const onDeletePublicDashboardClick = (pd, onDelete) => {
        deletePublicDashboard({
            dashboard,
            uid: pd.uid,
            dashboardUid: pd.dashboardUid,
        });
        onDelete();
    };
    return (React.createElement(ModalsController, null, ({ showModal, hideModal }) => (React.createElement(Button, Object.assign({ "aria-label": "Revoke public URL", title: "Revoke public URL", onClick: () => showModal(DeletePublicDashboardModal, {
            dashboardTitle: publicDashboard.title,
            onConfirm: () => onDeletePublicDashboardClick(publicDashboard, hideModal),
            onDismiss: () => {
                onDismiss ? onDismiss() : hideModal();
            },
        }) }, rest), isLoading && loader ? loader : children))));
};
//# sourceMappingURL=DeletePublicDashboardButton.js.map