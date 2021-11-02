import { __awaiter, __generator, __makeTemplateObject } from "tslib";
import React, { useEffect } from 'react';
import { Button, ConfirmModal, Modal, stylesFactory, useTheme } from '@grafana/ui';
import { css } from '@emotion/css';
import { useDashboardSave } from './useDashboardSave';
import { SaveDashboardAsButton } from './SaveDashboardButton';
export var SaveDashboardErrorProxy = function (_a) {
    var dashboard = _a.dashboard, dashboardSaveModel = _a.dashboardSaveModel, error = _a.error, onDismiss = _a.onDismiss;
    var onDashboardSave = useDashboardSave(dashboard).onDashboardSave;
    useEffect(function () {
        if (error.data && isHandledError(error.data.status)) {
            error.isHandled = true;
        }
    }, [error]);
    return (React.createElement(React.Fragment, null,
        error.data && error.data.status === 'version-mismatch' && (React.createElement(ConfirmModal, { isOpen: true, title: "Conflict", body: React.createElement("div", null,
                "Someone else has updated this dashboard ",
                React.createElement("br", null),
                " ",
                React.createElement("small", null, "Would you still like to save this dashboard?")), confirmText: "Save and overwrite", onConfirm: function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, onDashboardSave(dashboardSaveModel, { overwrite: true }, dashboard)];
                        case 1:
                            _a.sent();
                            onDismiss();
                            return [2 /*return*/];
                    }
                });
            }); }, onDismiss: onDismiss })),
        error.data && error.data.status === 'name-exists' && (React.createElement(ConfirmModal, { isOpen: true, title: "Conflict", body: React.createElement("div", null,
                "A dashboard with the same name in selected folder already exists. ",
                React.createElement("br", null),
                React.createElement("small", null, "Would you still like to save this dashboard?")), confirmText: "Save and overwrite", onConfirm: function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, onDashboardSave(dashboardSaveModel, { overwrite: true }, dashboard)];
                        case 1:
                            _a.sent();
                            onDismiss();
                            return [2 /*return*/];
                    }
                });
            }); }, onDismiss: onDismiss })),
        error.data && error.data.status === 'plugin-dashboard' && (React.createElement(ConfirmPluginDashboardSaveModal, { dashboard: dashboard, onDismiss: onDismiss }))));
};
var ConfirmPluginDashboardSaveModal = function (_a) {
    var onDismiss = _a.onDismiss, dashboard = _a.dashboard;
    var theme = useTheme();
    var onDashboardSave = useDashboardSave(dashboard).onDashboardSave;
    var styles = getConfirmPluginDashboardSaveModalStyles(theme);
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
            React.createElement(Button, { variant: "destructive", onClick: function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, onDashboardSave(dashboard.getSaveModelClone(), { overwrite: true }, dashboard)];
                            case 1:
                                _a.sent();
                                onDismiss();
                                return [2 /*return*/];
                        }
                    });
                }); } }, "Overwrite"))));
};
var isHandledError = function (errorStatus) {
    switch (errorStatus) {
        case 'version-mismatch':
        case 'name-exists':
        case 'plugin-dashboard':
            return true;
        default:
            return false;
    }
};
var getConfirmPluginDashboardSaveModalStyles = stylesFactory(function (theme) { return ({
    modal: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    width: 500px;\n  "], ["\n    width: 500px;\n  "]))),
    modalText: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    font-size: ", ";\n    color: ", ";\n    margin-bottom: calc(", " * 2);\n    padding-top: ", ";\n  "], ["\n    font-size: ", ";\n    color: ", ";\n    margin-bottom: calc(", " * 2);\n    padding-top: ", ";\n  "])), theme.typography.heading.h4, theme.colors.link, theme.spacing.d, theme.spacing.d),
    modalButtonRow: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin-bottom: 14px;\n    a,\n    button {\n      margin-right: ", ";\n    }\n  "], ["\n    margin-bottom: 14px;\n    a,\n    button {\n      margin-right: ", ";\n    }\n  "])), theme.spacing.d),
}); });
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=SaveDashboardErrorProxy.js.map