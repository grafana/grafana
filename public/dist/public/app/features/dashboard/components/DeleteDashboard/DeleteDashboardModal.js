import { __awaiter, __generator, __makeTemplateObject, __read } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { sumBy } from 'lodash';
import { Modal, ConfirmModal, Button } from '@grafana/ui';
import { useDashboardDelete } from './useDashboardDelete';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { config } from 'app/core/config';
export var DeleteDashboardModal = function (_a) {
    var hideModal = _a.hideModal, dashboard = _a.dashboard;
    var isProvisioned = dashboard.meta.provisioned;
    var onDeleteDashboard = useDashboardDelete(dashboard.uid).onDeleteDashboard;
    var _b = __read(useAsyncFn(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, onDeleteDashboard()];
                case 1:
                    _a.sent();
                    hideModal();
                    return [2 /*return*/];
            }
        });
    }); }, [hideModal]), 2), onConfirm = _b[1];
    var modalBody = getModalBody(dashboard.panels, dashboard.title);
    if (isProvisioned) {
        return React.createElement(ProvisionedDeleteModal, { hideModal: hideModal, provisionedId: dashboard.meta.provisionedExternalId });
    }
    return (React.createElement(ConfirmModal, { isOpen: true, body: modalBody, onConfirm: onConfirm, onDismiss: hideModal, title: "Delete", icon: "trash-alt", confirmText: "Delete" }));
};
var getModalBody = function (panels, title) {
    var totalAlerts = sumBy(panels, function (panel) { return (panel.alert ? 1 : 0); });
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
var ProvisionedDeleteModal = function (_a) {
    var hideModal = _a.hideModal, provisionedId = _a.provisionedId;
    return (React.createElement(Modal, { isOpen: true, title: "Cannot delete provisioned dashboard", icon: "trash-alt", onDismiss: hideModal, className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      width: 500px;\n    "], ["\n      width: 500px;\n    "]))) },
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
};
var templateObject_1;
//# sourceMappingURL=DeleteDashboardModal.js.map