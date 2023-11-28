import React from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Field, FieldSet } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { QueryEditorField } from './QueryEditorField';
import { useCorrelationsFormContext } from './correlationsFormContext';
export const ConfigureCorrelationTargetForm = () => {
    var _a, _b, _c, _d, _e;
    const { control, formState } = useFormContext();
    const withDsUID = (fn) => (ds) => fn(ds.uid);
    const { correlation } = useCorrelationsFormContext();
    const targetUID = useWatch({ name: 'targetUID' }) || (correlation === null || correlation === void 0 ? void 0 : correlation.targetUID);
    return (React.createElement(React.Fragment, null,
        React.createElement(FieldSet, { label: "Setup the target for the correlation (Step 2 of 3)" },
            React.createElement("p", null, "Define what data source the correlation will link to, and what query will run when the correlation is clicked."),
            React.createElement(Controller, { control: control, name: "targetUID", rules: { required: { value: true, message: 'This field is required.' } }, render: ({ field: { onChange, value } }) => {
                    var _a;
                    return (React.createElement(Field, { label: "Target", description: "Specify which data source is queried when the link is clicked", htmlFor: "target", invalid: !!formState.errors.targetUID, error: (_a = formState.errors.targetUID) === null || _a === void 0 ? void 0 : _a.message },
                        React.createElement(DataSourcePicker, { onChange: withDsUID(onChange), noDefault: true, current: value, inputId: "target", width: 32, disabled: correlation !== undefined })));
                } }),
            React.createElement(QueryEditorField, { name: "config.target", dsUid: targetUID, invalid: !!((_b = (_a = formState.errors) === null || _a === void 0 ? void 0 : _a.config) === null || _b === void 0 ? void 0 : _b.target), error: (_e = (_d = (_c = formState.errors) === null || _c === void 0 ? void 0 : _c.config) === null || _d === void 0 ? void 0 : _d.target) === null || _e === void 0 ? void 0 : _e.message }))));
};
//# sourceMappingURL=ConfigureCorrelationTargetForm.js.map