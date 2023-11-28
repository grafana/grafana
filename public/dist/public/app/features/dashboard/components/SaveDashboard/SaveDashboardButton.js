import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import { Button, ModalsController } from '@grafana/ui';
import { SaveDashboardDrawer } from './SaveDashboardDrawer';
export const SaveDashboardButton = ({ dashboard, onSaveSuccess, size }) => {
    return (React.createElement(ModalsController, null, ({ showModal, hideModal }) => {
        return (React.createElement(Button, { size: size, onClick: () => {
                showModal(SaveDashboardDrawer, {
                    dashboard,
                    onSaveSuccess,
                    onDismiss: hideModal,
                });
            }, "aria-label": selectors.pages.Dashboard.Settings.General.saveDashBoard }, "Save dashboard"));
    }));
};
export const SaveDashboardAsButton = ({ dashboard, onSaveSuccess, variant, size }) => {
    return (React.createElement(ModalsController, null, ({ showModal, hideModal }) => {
        return (React.createElement(Button, { size: size, onClick: () => {
                reportInteraction('grafana_dashboard_save_as_clicked');
                showModal(SaveDashboardDrawer, {
                    dashboard,
                    onSaveSuccess,
                    onDismiss: hideModal,
                    isCopy: true,
                });
            }, variant: variant, "aria-label": selectors.pages.Dashboard.Settings.General.saveAsDashBoard }, "Save as"));
    }));
};
//# sourceMappingURL=SaveDashboardButton.js.map