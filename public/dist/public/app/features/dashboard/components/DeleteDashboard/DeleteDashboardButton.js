import React from 'react';
import { DeleteDashboardModal } from './DeleteDashboardModal';
import { Button, ModalsController } from '@grafana/ui';
export var DeleteDashboardButton = function (_a) {
    var dashboard = _a.dashboard;
    return (React.createElement(ModalsController, null, function (_a) {
        var showModal = _a.showModal, hideModal = _a.hideModal;
        return (React.createElement(Button, { variant: "destructive", onClick: function () {
                showModal(DeleteDashboardModal, {
                    dashboard: dashboard,
                    hideModal: hideModal,
                });
            }, "aria-label": "Dashboard settings page delete dashboard button" }, "Delete Dashboard"));
    }));
};
//# sourceMappingURL=DeleteDashboardButton.js.map