import { __assign, __awaiter, __generator, __rest } from "tslib";
import React from 'react';
import { Button, Input, Switch, Form, Field, InputControl, Modal } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import validationSrv from 'app/features/manage-dashboards/services/ValidationSrv';
var getSaveAsDashboardClone = function (dashboard) {
    var clone = dashboard.getSaveModelClone();
    clone.id = null;
    clone.uid = '';
    clone.title += ' Copy';
    clone.editable = true;
    clone.hideControls = false;
    // remove alerts if source dashboard is already persisted
    // do not want to create alert dupes
    if (dashboard.id > 0) {
        clone.panels.forEach(function (panel) {
            if (panel.type === 'graph' && panel.alert) {
                delete panel.thresholds;
            }
            delete panel.alert;
        });
    }
    delete clone.autoUpdate;
    return clone;
};
export var SaveDashboardAsForm = function (_a) {
    var dashboard = _a.dashboard, onSubmit = _a.onSubmit, onCancel = _a.onCancel, onSuccess = _a.onSuccess;
    var defaultValues = {
        title: dashboard.title + " Copy",
        $folder: {
            id: dashboard.meta.folderId,
            title: dashboard.meta.folderTitle,
        },
        copyTags: false,
    };
    var validateDashboardName = function (getFormValues) { return function (dashboardName) { return __awaiter(void 0, void 0, void 0, function () {
        var e_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (dashboardName && dashboardName === ((_a = getFormValues().$folder.title) === null || _a === void 0 ? void 0 : _a.trim())) {
                        return [2 /*return*/, 'Dashboard name cannot be the same as folder name'];
                    }
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, validationSrv.validateNewDashboardName(getFormValues().$folder.id, dashboardName)];
                case 2:
                    _b.sent();
                    return [2 /*return*/, true];
                case 3:
                    e_1 = _b.sent();
                    return [2 /*return*/, e_1.message];
                case 4: return [2 /*return*/];
            }
        });
    }); }; };
    return (React.createElement(Form, { defaultValues: defaultValues, onSubmit: function (data) { return __awaiter(void 0, void 0, void 0, function () {
            var clone, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!onSubmit) {
                            return [2 /*return*/];
                        }
                        clone = getSaveAsDashboardClone(dashboard);
                        clone.title = data.title;
                        if (!data.copyTags) {
                            clone.tags = [];
                        }
                        return [4 /*yield*/, onSubmit(clone, {
                                folderId: data.$folder.id,
                            }, dashboard)];
                    case 1:
                        result = _a.sent();
                        if (result.status === 'success') {
                            onSuccess();
                        }
                        return [2 /*return*/];
                }
            });
        }); } }, function (_a) {
        var _b;
        var register = _a.register, control = _a.control, errors = _a.errors, getValues = _a.getValues;
        return (React.createElement(React.Fragment, null,
            React.createElement(Field, { label: "Dashboard name", invalid: !!errors.title, error: (_b = errors.title) === null || _b === void 0 ? void 0 : _b.message },
                React.createElement(Input, __assign({}, register('title', {
                    validate: validateDashboardName(getValues),
                }), { "aria-label": "Save dashboard title field", autoFocus: true }))),
            React.createElement(Field, { label: "Folder" },
                React.createElement(InputControl, { render: function (_a) {
                        var _b = _a.field, ref = _b.ref, field = __rest(_b, ["ref"]);
                        return (React.createElement(FolderPicker, __assign({}, field, { dashboardId: dashboard.id, initialFolderId: dashboard.meta.folderId, initialTitle: dashboard.meta.folderTitle, enableCreateNew: true })));
                    }, control: control, name: "$folder" })),
            React.createElement(Field, { label: "Copy tags" },
                React.createElement(Switch, __assign({}, register('copyTags')))),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { type: "button", variant: "secondary", onClick: onCancel, fill: "outline" }, "Cancel"),
                React.createElement(Button, { type: "submit", "aria-label": "Save dashboard button" }, "Save"))));
    }));
};
//# sourceMappingURL=SaveDashboardAsForm.js.map