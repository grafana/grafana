import { css } from '@emotion/css';
import React from 'react';
import { toOption } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { AutoSizeInput, Button, Checkbox, Select, useStyles2 } from '@grafana/ui';
import { getOperationParamId } from './operationUtils';
export function getOperationParamEditor(paramDef) {
    if (paramDef.editor) {
        return paramDef.editor;
    }
    if (paramDef.options) {
        return SelectInputParamEditor;
    }
    switch (paramDef.type) {
        case 'boolean':
            return BoolInputParamEditor;
        case 'number':
        case 'string':
        default:
            return SimpleInputParamEditor;
    }
}
function SimpleInputParamEditor(props) {
    var _a;
    return (React.createElement(AutoSizeInput, { id: getOperationParamId(props.operationId, props.index), defaultValue: (_a = props.value) === null || _a === void 0 ? void 0 : _a.toString(), minWidth: props.paramDef.minWidth, placeholder: props.paramDef.placeholder, title: props.paramDef.description, maxWidth: (props.paramDef.minWidth || 20) * 3, onCommitChange: (evt) => {
            props.onChange(props.index, evt.currentTarget.value);
            if (props.paramDef.runQueryOnEnter && evt.type === 'keydown') {
                props.onRunQuery();
            }
        } }));
}
function BoolInputParamEditor(props) {
    return (React.createElement(Checkbox, { id: getOperationParamId(props.operationId, props.index), value: Boolean(props.value), onChange: (evt) => props.onChange(props.index, evt.currentTarget.checked) }));
}
function SelectInputParamEditor({ paramDef, value, index, operationId, onChange, }) {
    var _a, _b;
    const styles = useStyles2(getStyles);
    let selectOptions = paramDef.options;
    if (!((_a = selectOptions[0]) === null || _a === void 0 ? void 0 : _a.label)) {
        selectOptions = paramDef.options.map((option) => ({
            label: option.toString(),
            value: option,
        }));
    }
    let valueOption = (_b = selectOptions.find((x) => x.value === value)) !== null && _b !== void 0 ? _b : toOption(value);
    // If we have optional options param and don't have value, we want to render button with which we add optional options.
    // This makes it easier to understand what needs to be selected and what is optional.
    if (!value && paramDef.optional) {
        return (React.createElement("div", { className: styles.optionalParam },
            React.createElement(Button, { size: "sm", variant: "secondary", title: `Add ${paramDef.name}`, icon: "plus", onClick: () => onChange(index, selectOptions[0].value) }, paramDef.name)));
    }
    return (React.createElement(Stack, { gap: 0.5, direction: "row", alignItems: "center", wrap: false },
        React.createElement(Select, { id: getOperationParamId(operationId, index), value: valueOption, options: selectOptions, placeholder: paramDef.placeholder, allowCustomValue: true, onChange: (value) => onChange(index, value.value), width: paramDef.minWidth || 'auto' }),
        paramDef.optional && (React.createElement(Button, { "data-testid": `operations.${index}.remove-param`, size: "sm", fill: "text", icon: "times", variant: "secondary", title: `Remove ${paramDef.name}`, onClick: () => onChange(index, '') }))));
}
const getStyles = (theme) => {
    return {
        optionalParam: css({
            marginTop: theme.spacing(1),
        }),
    };
};
//# sourceMappingURL=OperationParamEditor.js.map