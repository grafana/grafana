import React from 'react';
import { Button, ModalsController } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { DeleteDashboardModal } from './DeleteDashboardModal';
export const DeleteDashboardButton = ({ dashboard }) => (React.createElement(ModalsController, null, ({ showModal, hideModal }) => (React.createElement(Button, { variant: "destructive", onClick: () => {
        showModal(DeleteDashboardModal, {
            dashboard,
            hideModal,
        });
    }, "aria-label": "Dashboard settings page delete dashboard button" },
    React.createElement(Trans, { i18nKey: "dashboard-settings.dashboard-delete-button" }, "Delete Dashboard")))));
//# sourceMappingURL=DeleteDashboardButton.js.map