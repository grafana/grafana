import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import { sumBy } from 'lodash';
import React from 'react';
import { connect } from 'react-redux';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { Modal, ConfirmModal, Button } from '@grafana/ui';
import { config } from 'app/core/config';
import { cleanUpDashboardAndVariables } from 'app/features/dashboard/state/actions';
import { useDashboardDelete } from './useDashboardDelete';
const mapDispatchToProps = {
    cleanUpDashboardAndVariables,
};
const connector = connect(null, mapDispatchToProps);
const DeleteDashboardModalUnconnected = ({ hideModal, cleanUpDashboardAndVariables, dashboard }) => {
    const isProvisioned = dashboard.meta.provisioned;
    const { onDeleteDashboard } = useDashboardDelete(dashboard.uid, cleanUpDashboardAndVariables);
    const [, onConfirm] = useAsyncFn(() => __awaiter(void 0, void 0, void 0, function* () {
        yield onDeleteDashboard();
        hideModal();
    }), [hideModal]);
    const modalBody = getModalBody(dashboard.panels, dashboard.title);
    if (isProvisioned) {
        return React.createElement(ProvisionedDeleteModal, { hideModal: hideModal, provisionedId: dashboard.meta.provisionedExternalId });
    }
    return (React.createElement(ConfirmModal, { isOpen: true, body: modalBody, onConfirm: onConfirm, onDismiss: hideModal, title: "Delete", icon: "trash-alt", confirmText: "Delete" }));
};
const getModalBody = (panels, title) => {
    const totalAlerts = sumBy(panels, (panel) => (panel.alert ? 1 : 0));
    return totalAlerts > 0 && !config.unifiedAlertingEnabled ? (React.createElement(React.Fragment, null,
        React.createElement("p", null, "Do you want to delete this dashboard?"),
        React.createElement("p", null,
            "This dashboard contains ",
            totalAlerts,
            " alert",
            totalAlerts > 1 ? 's' : '',
            ". Deleting this dashboard also deletes those alerts."))) : (React.createElement(React.Fragment, null,
        React.createElement("p", null, "Do you want to delete this dashboard?"),
        React.createElement("p", null, title)));
};
const ProvisionedDeleteModal = ({ hideModal, provisionedId }) => (React.createElement(Modal, { isOpen: true, title: "Cannot delete provisioned dashboard", icon: "trash-alt", onDismiss: hideModal, className: css `
      width: 500px;
    ` },
    React.createElement("p", null, "This dashboard is managed by Grafana provisioning and cannot be deleted. Remove the dashboard from the config file to delete it."),
    React.createElement("p", null,
        React.createElement("i", null,
            "See",
            ' ',
            React.createElement("a", { className: "external-link", href: "https://grafana.com/docs/grafana/latest/administration/provisioning/#dashboards", target: "_blank", rel: "noreferrer" }, "documentation"),
            ' ',
            "for more information about provisioning."),
        React.createElement("br", null),
        "File path: ",
        provisionedId),
    React.createElement(Modal.ButtonRow, null,
        React.createElement(Button, { variant: "primary", onClick: hideModal }, "OK"))));
export const DeleteDashboardModal = connector(DeleteDashboardModalUnconnected);
//# sourceMappingURL=DeleteDashboardModal.js.map