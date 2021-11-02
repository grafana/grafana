import { __makeTemplateObject, __read } from "tslib";
import React, { useState } from 'react';
import { css } from '@emotion/css';
import { Modal } from '@grafana/ui';
import { SaveDashboardAsForm } from './forms/SaveDashboardAsForm';
import { SaveDashboardErrorProxy } from './SaveDashboardErrorProxy';
import { useDashboardSave } from './useDashboardSave';
export var SaveDashboardAsModal = function (_a) {
    var dashboard = _a.dashboard, onDismiss = _a.onDismiss, isNew = _a.isNew;
    var _b = useDashboardSave(dashboard), state = _b.state, onDashboardSave = _b.onDashboardSave;
    var _c = __read(useState(), 2), dashboardSaveModelClone = _c[0], setDashboardSaveModelClone = _c[1];
    return (React.createElement(React.Fragment, null,
        state.error && (React.createElement(SaveDashboardErrorProxy, { error: state.error, dashboard: dashboard, dashboardSaveModel: dashboardSaveModelClone, onDismiss: onDismiss })),
        !state.error && (React.createElement(Modal, { isOpen: true, title: "Save dashboard as...", icon: "copy", onDismiss: onDismiss, className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n            width: 500px;\n          "], ["\n            width: 500px;\n          "]))) },
            React.createElement(SaveDashboardAsForm, { dashboard: dashboard, onCancel: onDismiss, onSuccess: onDismiss, onSubmit: function (clone, options, dashboard) {
                    setDashboardSaveModelClone(clone);
                    return onDashboardSave(clone, options, dashboard);
                }, isNew: isNew })))));
};
var templateObject_1;
//# sourceMappingURL=SaveDashboardAsModal.js.map