import { __assign, __makeTemplateObject } from "tslib";
import React, { useMemo, useCallback } from 'react';
import { css } from '@emotion/css';
import { DataTransformerID, standardTransformers, getFieldDisplayName, FieldType, ValueMatcherID, valueMatchers, } from '@grafana/data';
import { Button, RadioButtonGroup, stylesFactory } from '@grafana/ui';
import { cloneDeep } from 'lodash';
import { FilterByValueMatch, FilterByValueType, } from '@grafana/data/src/transformations/transformers/filterByValue';
import { FilterByValueFilterEditor } from './FilterByValueFilterEditor';
var filterTypes = [
    { label: 'Include', value: FilterByValueType.include },
    { label: 'Exclude', value: FilterByValueType.exclude },
];
var filterMatch = [
    { label: 'Match all', value: FilterByValueMatch.all },
    { label: 'Match any', value: FilterByValueMatch.any },
];
export var FilterByValueTransformerEditor = function (props) {
    var input = props.input, options = props.options, onChange = props.onChange;
    var styles = getEditorStyles();
    var fieldsInfo = useFieldsInfo(input);
    var onAddFilter = useCallback(function () {
        var frame = input[0];
        var field = frame.fields.find(function (f) { return f.type !== FieldType.time; });
        if (!field) {
            return;
        }
        var filters = cloneDeep(options.filters);
        var matcher = valueMatchers.get(ValueMatcherID.greater);
        filters.push({
            fieldName: getFieldDisplayName(field, frame, input),
            config: {
                id: matcher.id,
                options: matcher.getDefaultOptions(field),
            },
        });
        onChange(__assign(__assign({}, options), { filters: filters }));
    }, [onChange, options, input]);
    var onDeleteFilter = useCallback(function (index) {
        var filters = cloneDeep(options.filters);
        filters.splice(index, 1);
        onChange(__assign(__assign({}, options), { filters: filters }));
    }, [options, onChange]);
    var onChangeFilter = useCallback(function (filter, index) {
        var filters = cloneDeep(options.filters);
        filters[index] = filter;
        onChange(__assign(__assign({}, options), { filters: filters }));
    }, [options, onChange]);
    var onChangeType = useCallback(function (type) {
        onChange(__assign(__assign({}, options), { type: type !== null && type !== void 0 ? type : FilterByValueType.include }));
    }, [options, onChange]);
    var onChangeMatch = useCallback(function (match) {
        onChange(__assign(__assign({}, options), { match: match !== null && match !== void 0 ? match : FilterByValueMatch.all }));
    }, [options, onChange]);
    return (React.createElement("div", null,
        React.createElement("div", { className: "gf-form gf-form-inline" },
            React.createElement("div", { className: "gf-form-label width-8" }, "Filter type"),
            React.createElement("div", { className: "width-15" },
                React.createElement(RadioButtonGroup, { options: filterTypes, value: options.type, onChange: onChangeType, fullWidth: true }))),
        React.createElement("div", { className: "gf-form gf-form-inline" },
            React.createElement("div", { className: "gf-form-label width-8" }, "Conditions"),
            React.createElement("div", { className: "width-15" },
                React.createElement(RadioButtonGroup, { options: filterMatch, value: options.match, onChange: onChangeMatch, fullWidth: true }))),
        React.createElement("div", { className: styles.conditions },
            options.filters.map(function (filter, idx) { return (React.createElement(FilterByValueFilterEditor, { key: idx, filter: filter, fieldsInfo: fieldsInfo, onChange: function (filter) { return onChangeFilter(filter, idx); }, onDelete: function () { return onDeleteFilter(idx); } })); }),
            React.createElement("div", { className: "gf-form" },
                React.createElement(Button, { icon: "plus", size: "sm", onClick: onAddFilter, variant: "secondary" }, "Add condition")))));
};
export var filterByValueTransformRegistryItem = {
    id: DataTransformerID.filterByValue,
    editor: FilterByValueTransformerEditor,
    transformation: standardTransformers.filterByValueTransformer,
    name: standardTransformers.filterByValueTransformer.name,
    description: 'Removes rows of the query results using user-defined filters. This is useful if you can not filter your data in the data source.',
};
var getEditorStyles = stylesFactory(function () { return ({
    conditions: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    padding-left: 16px;\n  "], ["\n    padding-left: 16px;\n  "]))),
}); });
var useFieldsInfo = function (data) {
    return useMemo(function () {
        var meta = {
            fieldsAsOptions: [],
            fieldByDisplayName: {},
        };
        if (!Array.isArray(data)) {
            return meta;
        }
        return data.reduce(function (meta, frame) {
            return frame.fields.reduce(function (meta, field) {
                var fieldName = getFieldDisplayName(field, frame, data);
                if (meta.fieldByDisplayName[fieldName]) {
                    return meta;
                }
                meta.fieldsAsOptions.push({
                    label: fieldName,
                    value: fieldName,
                    type: field.type,
                });
                meta.fieldByDisplayName[fieldName] = field;
                return meta;
            }, meta);
        }, meta);
    }, [data]);
};
var templateObject_1;
//# sourceMappingURL=FilterByValueTransformerEditor.js.map