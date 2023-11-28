import { __awaiter, __rest } from "tslib";
import React, { useEffect, useState } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { ExpressionDatasourceRef } from '@grafana/runtime/src/utils/DataSourceWithBackend';
import { Button, Field, HorizontalGroup, Input, InputControl, Legend, } from '@grafana/ui';
import { OldFolderPicker } from 'app/core/components/Select/OldFolderPicker';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { LibraryPanelInputState, } from '../state/reducers';
import { validateTitle, validateUid } from '../utils/validation';
import { ImportDashboardLibraryPanelsList } from './ImportDashboardLibraryPanelsList';
export const ImportDashboardForm = ({ register, errors, control, getValues, uidReset, inputs, initialFolderUid, onUidReset, onCancel, onSubmit, watch, }) => {
    var _a, _b, _c, _d;
    const [isSubmitted, setSubmitted] = useState(false);
    const watchDataSources = watch('dataSources');
    const watchFolder = watch('folder');
    /*
      This useEffect is needed for overwriting a dashboard. It
      submits the form even if there's validation errors on title or uid.
    */
    useEffect(() => {
        if (isSubmitted && (errors.title || errors.uid)) {
            onSubmit(getValues());
        }
    }, [errors, getValues, isSubmitted, onSubmit]);
    const newLibraryPanels = (_b = (_a = inputs === null || inputs === void 0 ? void 0 : inputs.libraryPanels) === null || _a === void 0 ? void 0 : _a.filter((i) => i.state === LibraryPanelInputState.New)) !== null && _b !== void 0 ? _b : [];
    const existingLibraryPanels = (_d = (_c = inputs === null || inputs === void 0 ? void 0 : inputs.libraryPanels) === null || _c === void 0 ? void 0 : _c.filter((i) => i.state === LibraryPanelInputState.Exists)) !== null && _d !== void 0 ? _d : [];
    return (React.createElement(React.Fragment, null,
        React.createElement(Legend, null, "Options"),
        React.createElement(Field, { label: "Name", invalid: !!errors.title, error: errors.title && errors.title.message },
            React.createElement(Input, Object.assign({}, register('title', {
                required: 'Name is required',
                validate: (v) => __awaiter(void 0, void 0, void 0, function* () { return yield validateTitle(v, getValues().folder.uid); }),
            }), { type: "text", "data-testid": selectors.components.ImportDashboardForm.name }))),
        React.createElement(Field, { label: "Folder" },
            React.createElement(InputControl, { render: (_a) => {
                    var _b = _a.field, { ref } = _b, field = __rest(_b, ["ref"]);
                    return (React.createElement(OldFolderPicker, Object.assign({}, field, { enableCreateNew: true, initialFolderUid: initialFolderUid })));
                }, name: "folder", control: control })),
        React.createElement(Field, { label: "Unique identifier (UID)", description: "The unique identifier (UID) of a dashboard can be used for uniquely identify a dashboard between multiple Grafana installs.\n                The UID allows having consistent URLs for accessing dashboards so changing the title of a dashboard will not break any\n                bookmarked links to that dashboard.", invalid: !!errors.uid, error: errors.uid && errors.uid.message },
            React.createElement(React.Fragment, null, !uidReset ? (React.createElement(Input, Object.assign({ disabled: true }, register('uid', { validate: (v) => __awaiter(void 0, void 0, void 0, function* () { return yield validateUid(v); }) }), { addonAfter: !uidReset && React.createElement(Button, { onClick: onUidReset }, "Change uid") }))) : (React.createElement(Input, Object.assign({}, register('uid', { required: true, validate: (v) => __awaiter(void 0, void 0, void 0, function* () { return yield validateUid(v); }) })))))),
        inputs.dataSources &&
            inputs.dataSources.map((input, index) => {
                if (input.pluginId === ExpressionDatasourceRef.type) {
                    return null;
                }
                const dataSourceOption = `dataSources.${index}`;
                const current = watchDataSources !== null && watchDataSources !== void 0 ? watchDataSources : [];
                return (React.createElement(Field, { label: input.label, description: input.description, key: dataSourceOption, invalid: errors.dataSources && !!errors.dataSources[index], error: errors.dataSources && errors.dataSources[index] && 'A data source is required' },
                    React.createElement(InputControl, { name: dataSourceOption, render: (_a) => {
                            var _b;
                            var _c = _a.field, { ref } = _c, field = __rest(_c, ["ref"]);
                            return (React.createElement(DataSourcePicker, Object.assign({}, field, { noDefault: true, placeholder: input.info, pluginId: input.pluginId, current: (_b = current[index]) === null || _b === void 0 ? void 0 : _b.uid })));
                        }, control: control, rules: { required: true } })));
            }),
        inputs.constants &&
            inputs.constants.map((input, index) => {
                const constantIndex = `constants.${index}`;
                return (React.createElement(Field, { label: input.label, error: errors.constants && errors.constants[index] && `${input.label} needs a value`, invalid: errors.constants && !!errors.constants[index], key: constantIndex },
                    React.createElement(Input, Object.assign({}, register(constantIndex, { required: true }), { defaultValue: input.value }))));
            }),
        React.createElement(ImportDashboardLibraryPanelsList, { inputs: newLibraryPanels, label: "New library panels", description: "List of new library panels that will get imported.", folderName: watchFolder.title }),
        React.createElement(ImportDashboardLibraryPanelsList, { inputs: existingLibraryPanels, label: "Existing library panels", description: "List of existing library panels. These panels are not affected by the import.", folderName: watchFolder.title }),
        React.createElement(HorizontalGroup, null,
            React.createElement(Button, { type: "submit", "data-testid": selectors.components.ImportDashboardForm.submit, variant: getButtonVariant(errors), onClick: () => {
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