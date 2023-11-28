import { css } from '@emotion/css';
import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { Card, Field, FieldSet, Input, useStyles2 } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getVariableUsageInfo } from '../../explore/utils/links';
import { TransformationsEditor } from './TransformationsEditor';
import { useCorrelationsFormContext } from './correlationsFormContext';
import { getInputId } from './utils';
const getStyles = (theme) => ({
    label: css `
    max-width: ${theme.spacing(80)};
  `,
    variable: css `
    font-family: ${theme.typography.fontFamilyMonospace};
    font-weight: ${theme.typography.fontWeightMedium};
  `,
});
export const ConfigureCorrelationSourceForm = () => {
    var _a, _b, _c, _d, _e, _f;
    const { control, formState, register, getValues } = useFormContext();
    const styles = useStyles2(getStyles);
    const withDsUID = (fn) => (ds) => fn(ds.uid);
    const { correlation, readOnly } = useCorrelationsFormContext();
    const currentTargetQuery = getValues('config.target');
    const variables = getVariableUsageInfo(currentTargetQuery, {}).variables.map((variable) => variable.variableName + (variable.fieldPath ? `.${variable.fieldPath}` : ''));
    return (React.createElement(React.Fragment, null,
        React.createElement(FieldSet, { label: `Configure the data source that will link to ${(_a = getDatasourceSrv().getInstanceSettings(correlation === null || correlation === void 0 ? void 0 : correlation.targetUID)) === null || _a === void 0 ? void 0 : _a.name} (Step 3 of 3)` },
            React.createElement("p", null, "Define what data source will display the correlation, and what data will replace previously defined variables."),
            React.createElement(Controller, { control: control, name: "sourceUID", rules: {
                    required: { value: true, message: 'This field is required.' },
                }, render: ({ field: { onChange, value } }) => {
                    var _a;
                    return (React.createElement(Field, { label: "Source", description: "Results from selected source data source have links displayed in the panel", htmlFor: "source", invalid: !!formState.errors.sourceUID, error: (_a = formState.errors.sourceUID) === null || _a === void 0 ? void 0 : _a.message },
                        React.createElement(DataSourcePicker, { onChange: withDsUID(onChange), noDefault: true, current: value, inputId: "source", width: 32, disabled: correlation !== undefined })));
                } }),
            React.createElement(Field, { label: "Results field", description: "The link will be shown next to the value of this field", className: styles.label, invalid: !!((_c = (_b = formState.errors) === null || _b === void 0 ? void 0 : _b.config) === null || _c === void 0 ? void 0 : _c.field), error: (_f = (_e = (_d = formState.errors) === null || _d === void 0 ? void 0 : _d.config) === null || _e === void 0 ? void 0 : _e.field) === null || _f === void 0 ? void 0 : _f.message },
                React.createElement(Input, Object.assign({ id: getInputId('field', correlation) }, register('config.field', { required: 'This field is required.' }), { readOnly: readOnly }))),
            variables.length > 0 && (React.createElement(Card, null,
                React.createElement(Card.Heading, null, "Variables used in the target query"),
                React.createElement(Card.Description, null,
                    "You have used following variables in the target query:",
                    ' ',
                    variables.map((name, i) => (React.createElement("span", { className: styles.variable, key: i },
                        name,
                        i < variables.length - 1 ? ', ' : ''))),
                    React.createElement("br", null),
                    "A data point needs to provide values to all variables as fields or as transformations output to make the correlation button appear in the visualization.",
                    React.createElement("br", null),
                    "Note: Not every variable needs to be explicitly defined below. A transformation such as",
                    ' ',
                    React.createElement("span", { className: styles.variable }, "logfmt"),
                    " will create variables for every key/value pair."))),
            React.createElement(TransformationsEditor, { readOnly: readOnly }))));
};
//# sourceMappingURL=ConfigureCorrelationSourceForm.js.map