import { __makeTemplateObject, __read } from "tslib";
import React, { useState } from 'react';
import { Modal } from '@grafana/ui';
import { css } from '@emotion/css';
import { SaveDashboardForm } from './forms/SaveDashboardForm';
import { SaveDashboardErrorProxy } from './SaveDashboardErrorProxy';
import { useDashboardSave } from './useDashboardSave';
export var SaveDashboardModal = function (_a) {
    var dashboard = _a.dashboard, onDismiss = _a.onDismiss, onSaveSuccess = _a.onSaveSuccess;
    var _b = useDashboardSave(dashboard), state = _b.state, onDashboardSave = _b.onDashboardSave;
    var _c = __read(useState(), 2), dashboardSaveModelClone = _c[0], setDashboardSaveModelClone = _c[1];
    return (React.createElement(React.Fragment, null,
        state.error && (React.createElement(SaveDashboardErrorProxy, { error: state.error, dashboard: dashboard, dashboardSaveModel: dashboardSaveModelClone, onDismiss: onDismiss })),
        !state.error && (React.createElement(Modal, { isOpen: true, title: "Save dashboard", icon: "copy", onDismiss: onDismiss, className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n            width: 500px;\n          "], ["\n            width: 500px;\n          "]))) },
            React.createElement(SaveDashboardForm, { dashboard: dashboard, onCancel: onDismiss, onSuccess: function () {
                    onDismiss();
                    if (onSaveSuccess) {
                        onSaveSuccess();
                    }
                }, onSubmit: function (clone, options, dashboard) {
                    setDashboardSaveModelClone(clone);
                    return onDashboardSave(clone, options, dashboard);
                } })))));
};
var templateObject_1;
//# sourceMappingURL=SaveDashboardModal.js.map