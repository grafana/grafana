import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { Button, ConfirmModal, Modal, useStyles2 } from '@grafana/ui';
import { SaveDashboardAsButton } from './SaveDashboardButton';
import { useDashboardSave } from './useDashboardSave';
export const SaveDashboardErrorProxy = ({ dashboard, dashboardSaveModel, error, onDismiss, }) => {
    const { onDashboardSave } = useDashboardSave();
    useEffect(() => {
        if (error.data && proxyHandlesError(error.data.status)) {
            error.isHandled = true;
        }
    }, [error]);
    return (React.createElement(React.Fragment, null,
        error.data && error.data.status === 'version-mismatch' && (React.createElement(ConfirmModal, { isOpen: true, title: "Conflict", body: React.createElement("div", null,
                "Someone else has updated this dashboard ",
                React.createElement("br", null),
                " ",
                React.createElement("small", null, "Would you still like to save this dashboard?")), confirmText: "Save and overwrite", onConfirm: () => __awaiter(void 0, void 0, void 0, function* () {
                yield onDashboardSave(dashboardSaveModel, { overwrite: true }, dashboard);
                onDismiss();
            }), onDismiss: onDismiss })),
        error.data && error.data.status === 'name-exists' && (React.createElement(ConfirmModal, { isOpen: true, title: "Conflict", body: React.createElement("div", null,
                "A dashboard with the same name in selected folder already exists. ",
                React.createElement("br", null),
                React.createElement("small", null, "Would you still like to save this dashboard?")), confirmText: "Save and overwrite", onConfirm: () => __awaiter(void 0, void 0, void 0, function* () {
                yield onDashboardSave(dashboardSaveModel, { overwrite: true }, dashboard);
                onDismiss();
            }), onDismiss: onDismiss })),
        error.data && error.data.status === 'plugin-dashboard' && (React.createElement(ConfirmPluginDashboardSaveModal, { dashboard: dashboard, onDismiss: onDismiss }))));
};
const ConfirmPluginDashboardSaveModal = ({ onDismiss, dashboard }) => {
    const { onDashboardSave } = useDashboardSave();
    const styles = useStyles2(getConfirmPluginDashboardSaveModalStyles);
    return (React.createElement(Modal, { className: styles.modal, title: "Plugin dashboard", icon: "copy", isOpen: true, onDismiss: onDismiss },
        React.createElement("div", { className: styles.modalText },
            "Your changes will be lost when you update the plugin.",
            React.createElement("br", null),
            React.createElement("small", null,
                "Use ",
                React.createElement("strong", null, "Save As"),
                " to create custom version.")),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(Button, { variant: "secondary", onClick: onDismiss, fill: "outline" }, "Cancel"),
            React.createElement(SaveDashboardAsButton, { dashboard: dashboard, onSaveSuccess: onDismiss }),
            React.createElement(Button, { variant: "destructive", onClick: () => __awaiter(void 0, void 0, void 0, function* () {
                    yield onDashboardSave(dashboard.getSaveModelClone(), { overwrite: true }, dashboard);
                    onDismiss();
                }) }, "Overwrite"))));
};
export const proxyHandlesError = (errorStatus) => {
    switch (errorStatus) {
        case 'version-mismatch':
        case 'name-exists':
        case 'plugin-dashboard':
            return true;
        default:
            return false;
    }
};
const getConfirmPluginDashboardSaveModalStyles = (theme) => ({
    modal: css `
    width: 500px;
  `,
    modalText: css `
    font-size: ${theme.typography.h4.fontSize};
    color: ${theme.colors.text.primary};
    margin-bottom: ${theme.spacing(4)}
    padding-top: ${theme.spacing(2)};
  `,
    modalButtonRow: css `
    margin-bottom: 14px;
    a,
    button {
      margin-right: ${theme.spacing(2)};
    }
  `,
});
//# sourceMappingURL=SaveDashboardErrorProxy.js.map