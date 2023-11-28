import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useStyles2, TextArea, InlineField, Input, FieldSet, InlineSwitch } from '@grafana/ui';
const renderInput = (field, onChange, config) => {
    var _a;
    switch (field.type) {
        case 'number':
            return (React.createElement(Input, { type: "number", defaultValue: config === null || config === void 0 ? void 0 : config[field.name], onChange: (e) => {
                    const newValue = e.currentTarget.valueAsNumber;
                    onChange(Object.assign(Object.assign({}, config), { [field.name]: newValue }));
                } }));
        case 'boolean':
            return (React.createElement(InlineSwitch, { value: (_a = config === null || config === void 0 ? void 0 : config[field.name]) !== null && _a !== void 0 ? _a : true, onChange: () => {
                    onChange(Object.assign(Object.assign({}, config), { [field.name]: !config[field.name] }));
                } }));
        default:
            return (React.createElement(Input, { type: "string", value: config === null || config === void 0 ? void 0 : config[field.name], onChange: (e) => {
                    const newValue = e.target.value;
                    onChange(Object.assign(Object.assign({}, config), { [field.name]: newValue }));
                } }));
    }
};
const getStyles = (theme) => {
    return {
        jsonView: css `
      margin-bottom: ${theme.spacing(1)};
    `,
    };
};
export const SimulationSchemaForm = ({ config, schema, onChange }) => {
    const [jsonView, setJsonView] = useState(false);
    const styles = useStyles2(getStyles);
    const onUpdateTextArea = (event) => {
        const element = event.currentTarget;
        onChange(JSON.parse(element.value));
    };
    return (React.createElement(FieldSet, { label: "Config" },
        React.createElement(InlineSwitch, { className: styles.jsonView, label: "JSON View", showLabel: true, value: jsonView, onChange: () => setJsonView(!jsonView) }),
        jsonView ? (React.createElement(TextArea, { defaultValue: JSON.stringify(config, null, 2), rows: 7, onChange: onUpdateTextArea })) : (React.createElement(React.Fragment, null, schema.fields.map((field) => (React.createElement(InlineField, { label: field.name, key: field.name, labelWidth: 14 }, renderInput(field, onChange, config))))))));
};
//# sourceMappingURL=SimulationSchemaForm.js.map