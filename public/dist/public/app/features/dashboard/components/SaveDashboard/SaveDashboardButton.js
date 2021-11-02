import React from 'react';
import { Button, ModalsController, FullWidthButtonContainer } from '@grafana/ui';
import { SaveDashboardAsModal } from './SaveDashboardAsModal';
import { SaveDashboardModalProxy } from './SaveDashboardModalProxy';
import { selectors } from '@grafana/e2e-selectors';
export var SaveDashboardButton = function (_a) {
    var dashboard = _a.dashboard, onSaveSuccess = _a.onSaveSuccess;
    return (React.createElement(ModalsController, null, function (_a) {
        var showModal = _a.showModal, hideModal = _a.hideModal;
        return (React.createElement(Button, { onClick: function () {
                showModal(SaveDashboardModalProxy, {
                    dashboard: dashboard,
                    onSaveSuccess: onSaveSuccess,
                    onDismiss: hideModal,
                });
            }, "aria-label": selectors.pages.Dashboard.Settings.General.saveDashBoard }, "Save dashboard"));
    }));
};
export var SaveDashboardAsButton = function (_a) {
    var dashboard = _a.dashboard, onSaveSuccess = _a.onSaveSuccess, variant = _a.variant;
    return (React.createElement(ModalsController, null, function (_a) {
        var showModal = _a.showModal, hideModal = _a.hideModal;
        return (React.createElement(FullWidthButtonContainer, null,
            React.createElement(Button, { onClick: function () {
                    showModal(SaveDashboardAsModal, {
                        dashboard: dashboard,
                        onSaveSuccess: onSaveSuccess,
                        onDismiss: hideModal,
                    });
                }, variant: variant, "aria-label": selectors.pages.Dashboard.Settings.General.saveAsDashBoard }, "Save As...")));
    }));
};
//# sourceMappingURL=SaveDashboardButton.js.map