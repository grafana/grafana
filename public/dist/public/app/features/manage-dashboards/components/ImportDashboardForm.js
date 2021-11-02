import { __assign, __awaiter, __generator, __read, __rest } from "tslib";
import React, { useEffect, useState } from 'react';
import { Button, Field, HorizontalGroup, Input, InputControl, Legend, } from '@grafana/ui';
import { DataSourcePicker } from '@grafana/runtime';
import { selectors } from '@grafana/e2e-selectors';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { LibraryPanelInputState, } from '../state/reducers';
import { validateTitle, validateUid } from '../utils/validation';
import { ImportDashboardLibraryPanelsList } from './ImportDashboardLibraryPanelsList';
export var ImportDashboardForm = function (_a) {
    var _b, _c, _d, _e;
    var register = _a.register, errors = _a.errors, control = _a.control, getValues = _a.getValues, uidReset = _a.uidReset, inputs = _a.inputs, initialFolderId = _a.initialFolderId, onUidReset = _a.onUidReset, onCancel = _a.onCancel, onSubmit = _a.onSubmit, watch = _a.watch;
    var _f = __read(useState(false), 2), isSubmitted = _f[0], setSubmitted = _f[1];
    var watchDataSources = watch('dataSources');
    var watchFolder = watch('folder');
    /*
      This useEffect is needed for overwriting a dashboard. It
      submits the form even if there's validation errors on title or uid.
    */
    useEffect(function () {
        if (isSubmitted && (errors.title || errors.uid)) {
            onSubmit(getValues(), {});
        }
    }, [errors, getValues, isSubmitted, onSubmit]);
    var newLibraryPanels = (_c = (_b = inputs === null || inputs === void 0 ? void 0 : inputs.libraryPanels) === null || _b === void 0 ? void 0 : _b.filter(function (i) { return i.state === LibraryPanelInputState.New; })) !== null && _c !== void 0 ? _c : [];
    var existingLibraryPanels = (_e = (_d = inputs === null || inputs === void 0 ? void 0 : inputs.libraryPanels) === null || _d === void 0 ? void 0 : _d.filter(function (i) { return i.state === LibraryPanelInputState.Exits; })) !== null && _e !== void 0 ? _e : [];
    return (React.createElement(React.Fragment, null,
        React.createElement(Legend, null, "Options"),
        React.createElement(Field, { label: "Name", invalid: !!errors.title, error: errors.title && errors.title.message },
            React.createElement(Input, __assign({}, register('title', {
                required: 'Name is required',
                validate: function (v) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, validateTitle(v, getValues().folder.id)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                }); }); },
            }), { type: "text", "data-testid": selectors.components.ImportDashboardForm.name }))),
        React.createElement(Field, { label: "Folder" },
            React.createElement(InputControl, { render: function (_a) {
                    var _b = _a.field, ref = _b.ref, field = __rest(_b, ["ref"]);
                    return (React.createElement(FolderPicker, __assign({}, field, { enableCreateNew: true, initialFolderId: initialFolderId })));
                }, name: "folder", control: control })),
        React.createElement(Field, { label: "Unique identifier (UID)", description: "The unique identifier (UID) of a dashboard can be used for uniquely identify a dashboard between multiple Grafana installs.\n                The UID allows having consistent URLs for accessing dashboards so changing the title of a dashboard will not break any\n                bookmarked links to that dashboard.", invalid: !!errors.uid, error: errors.uid && errors.uid.message },
            React.createElement(React.Fragment, null, !uidReset ? (React.createElement(Input, __assign({ disabled: true }, register('uid', { validate: function (v) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, validateUid(v)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                }); }); } }), { addonAfter: !uidReset && React.createElement(Button, { onClick: onUidReset }, "Change uid") }))) : (React.createElement(Input, __assign({}, register('uid', { required: true, validate: function (v) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, validateUid(v)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                }); }); } })))))),
        inputs.dataSources &&
            inputs.dataSources.map(function (input, index) {
                var dataSourceOption = "dataSources[" + index + "]";
                var current = watchDataSources !== null && watchDataSources !== void 0 ? watchDataSources : [];
                return (React.createElement(Field, { label: input.label, key: dataSourceOption, invalid: errors.dataSources && !!errors.dataSources[index], error: errors.dataSources && errors.dataSources[index] && 'A data source is required' },
                    React.createElement(InputControl, { name: dataSourceOption, render: function (_a) {
                            var _b;
                            var _c = _a.field, ref = _c.ref, field = __rest(_c, ["ref"]);
                            return (React.createElement(DataSourcePicker, __assign({}, field, { noDefault: true, placeholder: input.info, pluginId: input.pluginId, current: (_b = current[index]) === null || _b === void 0 ? void 0 : _b.name })));
                        }, control: control, rules: { required: true } })));
            }),
        inputs.constants &&
            inputs.constants.map(function (input, index) {
                var constantIndex = "constants[" + index + "]";
                return (React.createElement(Field, { label: input.label, error: errors.constants && errors.constants[index] && input.label + " needs a value", invalid: errors.constants && !!errors.constants[index], key: constantIndex },
                    React.createElement(Input, __assign({}, register(constantIndex, { required: true }), { defaultValue: input.value }))));
            }),
        React.createElement(ImportDashboardLibraryPanelsList, { inputs: newLibraryPanels, label: "New library panels", description: "List of new library panels that will get imported.", folderName: watchFolder.title }),
        React.createElement(ImportDashboardLibraryPanelsList, { inputs: existingLibraryPanels, label: "Existing library panels", description: "List of existing library panels. These panels are not affected by the import.", folderName: watchFolder.title }),
        React.createElement(HorizontalGroup, null,
            React.createElement(Button, { type: "submit", "data-testid": selectors.components.ImportDashboardForm.submit, variant: getButtonVariant(errors), onClick: function () {
                    setSubmitted(true);
                } }, getButtonText(errors)),
            React.createElement(Button, { type: "reset", variant: "secondary", onClick: onCancel }, "Cancel"))));
};
function getButtonVariant(errors) {
    return errors && (errors.title || errors.uid) ? 'destructive' : 'primary';
}
function getButtonText(errors) {
    return errors && (errors.title || errors.uid) ? 'Import (Overwrite)' : 'Import';
}
//# sourceMappingURL=ImportDashboardForm.js.map