import { __makeTemplateObject } from "tslib";
import React from 'react';
import { Button, Modal } from '@grafana/ui';
import { SaveDashboardButton } from './SaveDashboardButton';
import { css } from '@emotion/css';
export var UnsavedChangesModal = function (_a) {
    var dashboard = _a.dashboard, onSaveSuccess = _a.onSaveSuccess, onDiscard = _a.onDiscard, onDismiss = _a.onDismiss;
    return (React.createElement(Modal, { isOpen: true, title: "Unsaved changes", onDismiss: onDismiss, icon: "exclamation-triangle", className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n        width: 500px;\n      "], ["\n        width: 500px;\n      "]))) },
        React.createElement("h5", null, "Do you want to save your changes?"),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(Button, { variant: "secondary", onClick: onDismiss, fill: "outline" }, "Cancel"),
            React.createElement(Button, { variant: "destructive", onClick: onDiscard }, "Discard"),
            React.createElement(SaveDashboardButton, { dashboard: dashboard, onSaveSuccess: onSaveSuccess }))));
};
var templateObject_1;
//# sourceMappingURL=UnsavedChangesModal.js.map