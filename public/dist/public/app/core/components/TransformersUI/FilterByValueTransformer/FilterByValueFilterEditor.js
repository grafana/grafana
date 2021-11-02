import { __assign, __values } from "tslib";
import React, { useCallback } from 'react';
import { Button, Select } from '@grafana/ui';
import { valueMatchers } from '@grafana/data';
import { valueMatchersUI } from './ValueMatchers/valueMatchersUI';
export var FilterByValueFilterEditor = function (props) {
    var _a, _b;
    var onDelete = props.onDelete, onChange = props.onChange, filter = props.filter, fieldsInfo = props.fieldsInfo;
    var fieldsAsOptions = fieldsInfo.fieldsAsOptions, fieldByDisplayName = fieldsInfo.fieldByDisplayName;
    var fieldName = (_a = getFieldName(filter, fieldsAsOptions)) !== null && _a !== void 0 ? _a : '';
    var field = fieldByDisplayName[fieldName];
    var matcherOptions = field ? getMatcherOptions(field) : [];
    var matcherId = getSelectedMatcherId(filter, matcherOptions);
    var editor = valueMatchersUI.getIfExists(matcherId);
    var onChangeField = useCallback(function (selectable) {
        if (!(selectable === null || selectable === void 0 ? void 0 : selectable.value)) {
            return;
        }
        onChange(__assign(__assign({}, filter), { fieldName: selectable.value }));
    }, [onChange, filter]);
    var onChangeMatcher = useCallback(function (selectable) {
        if (!(selectable === null || selectable === void 0 ? void 0 : selectable.value)) {
            return;
        }
        var id = selectable.value;
        var options = valueMatchers.get(id).getDefaultOptions(field);
        onChange(__assign(__assign({}, filter), { config: { id: id, options: options } }));
    }, [onChange, filter, field]);
    var onChangeMatcherOptions = useCallback(function (options) {
        onChange(__assign(__assign({}, filter), { config: __assign(__assign({}, filter.config), { options: options }) }));
    }, [onChange, filter]);
    if (!field || !editor || !editor.component) {
        return null;
    }
    return (React.createElement("div", { className: "gf-form-inline" },
        React.createElement("div", { className: "gf-form gf-form-spacing" },
            React.createElement("div", { className: "gf-form-label width-7" }, "Field"),
            React.createElement(Select, { menuShouldPortal: true, className: "min-width-15 max-width-24", placeholder: "Field Name", options: fieldsAsOptions, value: filter.fieldName, onChange: onChangeField })),
        React.createElement("div", { className: "gf-form gf-form-spacing" },
            React.createElement("div", { className: "gf-form-label" }, "Match"),
            React.createElement(Select, { menuShouldPortal: true, className: "width-12", placeholder: "Select test", options: matcherOptions, value: matcherId, onChange: onChangeMatcher })),
        React.createElement("div", { className: "gf-form gf-form--grow gf-form-spacing" },
            React.createElement("div", { className: "gf-form-label" }, "Value"),
            React.createElement(editor.component, { field: field, options: (_b = filter.config.options) !== null && _b !== void 0 ? _b : {}, onChange: onChangeMatcherOptions })),
        React.createElement("div", { className: "gf-form" },
            React.createElement(Button, { icon: "times", onClick: onDelete, variant: "secondary" }))));
};
var getMatcherOptions = function (field) {
    var e_1, _a;
    var options = [];
    try {
        for (var _b = __values(valueMatchers.list()), _c = _b.next(); !_c.done; _c = _b.next()) {
            var matcher = _c.value;
            if (!matcher.isApplicable(field)) {
                continue;
            }
            var editor = valueMatchersUI.getIfExists(matcher.id);
            if (!editor) {
                continue;
            }
            options.push({
                value: matcher.id,
                label: matcher.name,
                description: matcher.description,
            });
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return options;
};
var getSelectedMatcherId = function (filter, matcherOptions) {
    var _a, _b;
    var matcher = matcherOptions.find(function (m) { return m.value === filter.config.id; });
    if (matcher && matcher.value) {
        return matcher.value;
    }
    if ((_a = matcherOptions[0]) === null || _a === void 0 ? void 0 : _a.value) {
        return (_b = matcherOptions[0]) === null || _b === void 0 ? void 0 : _b.value;
    }
    return;
};
var getFieldName = function (filter, fieldOptions) {
    var _a, _b;
    var fieldName = fieldOptions.find(function (m) { return m.value === filter.fieldName; });
    if (fieldName && fieldName.value) {
        return fieldName.value;
    }
    if ((_a = fieldOptions[0]) === null || _a === void 0 ? void 0 : _a.value) {
        return (_b = fieldOptions[0]) === null || _b === void 0 ? void 0 : _b.value;
    }
    return;
};
//# sourceMappingURL=FilterByValueFilterEditor.js.map