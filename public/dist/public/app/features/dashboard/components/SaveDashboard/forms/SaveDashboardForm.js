import { __assign, __awaiter, __generator } from "tslib";
import React, { useMemo } from 'react';
import { Button, Checkbox, Form, Modal, TextArea } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
export var SaveDashboardForm = function (_a) {
    var dashboard = _a.dashboard, onCancel = _a.onCancel, onSuccess = _a.onSuccess, onSubmit = _a.onSubmit;
    var hasTimeChanged = useMemo(function () { return dashboard.hasTimeChanged(); }, [dashboard]);
    var hasVariableChanged = useMemo(function () { return dashboard.hasVariableValuesChanged(); }, [dashboard]);
    return (React.createElement(Form, { onSubmit: function (data) { return __awaiter(void 0, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!onSubmit) {
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, onSubmit(dashboard.getSaveModelClone(data), data, dashboard)];
                    case 1:
                        result = _a.sent();
                        if (result.status === 'success') {
                            if (data.saveVariables) {
                                dashboard.resetOriginalVariables();
                            }
                            if (data.saveTimerange) {
                                dashboard.resetOriginalTime();
                            }
                            onSuccess();
                        }
                        return [2 /*return*/];
                }
            });
        }); } }, function (_a) {
        var register = _a.register, errors = _a.errors;
        return (React.createElement(React.Fragment, null,
            React.createElement("div", null,
                hasTimeChanged && (React.createElement(Checkbox, __assign({}, register('saveTimerange'), { label: "Save current time range as dashboard default", "aria-label": selectors.pages.SaveDashboardModal.saveTimerange }))),
                hasVariableChanged && (React.createElement(Checkbox, __assign({}, register('saveVariables'), { label: "Save current variable values as dashboard default", "aria-label": selectors.pages.SaveDashboardModal.saveVariables }))),
                (hasVariableChanged || hasTimeChanged) && React.createElement("div", { className: "gf-form-group" }),
                React.createElement(TextArea, __assign({}, register('message'), { placeholder: "Add a note to describe your changes.", autoFocus: true }))),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { variant: "secondary", onClick: onCancel, fill: "outline" }, "Cancel"),
                React.createElement(Button, { type: "submit", "aria-label": selectors.pages.SaveDashboardModal.save }, "Save"))));
    }));
};
//# sourceMappingURL=SaveDashboardForm.js.map