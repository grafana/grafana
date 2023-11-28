import React, { useCallback } from 'react';
import { valueMatchers } from '@grafana/data';
import { Button, Select, InlineField, InlineFieldRow } from '@grafana/ui';
import { Box } from '@grafana/ui/src/unstable';
import { valueMatchersUI } from './ValueMatchers/valueMatchersUI';
export const FilterByValueFilterEditor = (props) => {
    var _a, _b;
    const { onDelete, onChange, filter, fieldsInfo } = props;
    const { fieldsAsOptions, fieldByDisplayName } = fieldsInfo;
    const fieldName = (_a = getFieldName(filter, fieldsAsOptions)) !== null && _a !== void 0 ? _a : '';
    const field = fieldByDisplayName[fieldName];
    const matcherOptions = field ? getMatcherOptions(field) : [];
    const matcherId = getSelectedMatcherId(filter, matcherOptions);
    const editor = valueMatchersUI.getIfExists(matcherId);
    const onChangeField = useCallback((selectable) => {
        if (!(selectable === null || selectable === void 0 ? void 0 : selectable.value)) {
            return;
        }
        onChange(Object.assign(Object.assign({}, filter), { fieldName: selectable.value }));
    }, [onChange, filter]);
    const onChangeMatcher = useCallback((selectable) => {
        if (!(selectable === null || selectable === void 0 ? void 0 : selectable.value)) {
            return;
        }
        const id = selectable.value;
        const options = valueMatchers.get(id).getDefaultOptions(field);
        onChange(Object.assign(Object.assign({}, filter), { config: { id, options } }));
    }, [onChange, filter, field]);
    const onChangeMatcherOptions = useCallback((options) => {
        onChange(Object.assign(Object.assign({}, filter), { config: Object.assign(Object.assign({}, filter.config), { options }) }));
    }, [onChange, filter]);
    if (!field || !editor || !editor.component) {
        return null;
    }
    return (React.createElement(InlineFieldRow, null,
        React.createElement(InlineField, { label: "Field", labelWidth: 14 },
            React.createElement(Select, { className: "min-width-15 max-width-24", placeholder: "Field Name", options: fieldsAsOptions, value: filter.fieldName, onChange: onChangeField })),
        React.createElement(InlineField, { label: "Match" },
            React.createElement(Select, { className: "width-12", placeholder: "Select test", options: matcherOptions, value: matcherId, onChange: onChangeMatcher })),
        React.createElement(InlineField, { label: "Value", grow: true },
            React.createElement(editor.component, { field: field, options: (_b = filter.config.options) !== null && _b !== void 0 ? _b : {}, onChange: onChangeMatcherOptions })),
        React.createElement(Box, { marginBottom: 0.5 },
            React.createElement(Button, { icon: "times", onClick: onDelete, variant: "secondary" }))));
};
const getMatcherOptions = (field) => {
    const options = [];
    for (const matcher of valueMatchers.list()) {
        if (!matcher.isApplicable(field)) {
            continue;
        }
        const editor = valueMatchersUI.getIfExists(matcher.id);
        if (!editor) {
            continue;
        }
        options.push({
            value: matcher.id,
            label: matcher.name,
            description: matcher.description,
        });
    }
    return options;
};
const getSelectedMatcherId = (filter, matcherOptions) => {
    var _a, _b;
    const matcher = matcherOptions.find((m) => m.value === filter.config.id);
    if (matcher && matcher.value) {
        return matcher.value;
    }
    if ((_a = matcherOptions[0]) === null || _a === void 0 ? void 0 : _a.value) {
        return (_b = matcherOptions[0]) === null || _b === void 0 ? void 0 : _b.value;
    }
    return;
};
const getFieldName = (filter, fieldOptions) => {
    var _a, _b;
    const fieldName = fieldOptions.find((m) => m.value === filter.fieldName);
    if (fieldName && fieldName.value) {
        return fieldName.value;
    }
    if ((_a = fieldOptions[0]) === null || _a === void 0 ? void 0 : _a.value) {
        return (_b = fieldOptions[0]) === null || _b === void 0 ? void 0 : _b.value;
    }
    return;
};
//# sourceMappingURL=FilterByValueFilterEditor.js.map