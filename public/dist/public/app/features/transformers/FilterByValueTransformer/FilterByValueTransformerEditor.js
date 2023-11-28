import { cloneDeep } from 'lodash';
import React, { useMemo, useCallback } from 'react';
import { DataTransformerID, standardTransformers, getFieldDisplayName, FieldType, ValueMatcherID, valueMatchers, TransformerCategory, } from '@grafana/data';
import { FilterByValueMatch, FilterByValueType, } from '@grafana/data/src/transformations/transformers/filterByValue';
import { Button, RadioButtonGroup, InlineField } from '@grafana/ui';
import { Box } from '@grafana/ui/src/unstable';
import { FilterByValueFilterEditor } from './FilterByValueFilterEditor';
const filterTypes = [
    { label: 'Include', value: FilterByValueType.include },
    { label: 'Exclude', value: FilterByValueType.exclude },
];
const filterMatch = [
    { label: 'Match all', value: FilterByValueMatch.all },
    { label: 'Match any', value: FilterByValueMatch.any },
];
export const FilterByValueTransformerEditor = (props) => {
    const { input, options, onChange } = props;
    const fieldsInfo = useFieldsInfo(input);
    const onAddFilter = useCallback(() => {
        const frame = input[0];
        const field = frame.fields.find((f) => f.type !== FieldType.time);
        if (!field) {
            return;
        }
        const filters = cloneDeep(options.filters);
        const matcher = valueMatchers.get(ValueMatcherID.greater);
        filters.push({
            fieldName: getFieldDisplayName(field, frame, input),
            config: {
                id: matcher.id,
                options: matcher.getDefaultOptions(field),
            },
        });
        onChange(Object.assign(Object.assign({}, options), { filters }));
    }, [onChange, options, input]);
    const onDeleteFilter = useCallback((index) => {
        let filters = cloneDeep(options.filters);
        filters.splice(index, 1);
        onChange(Object.assign(Object.assign({}, options), { filters }));
    }, [options, onChange]);
    const onChangeFilter = useCallback((filter, index) => {
        let filters = cloneDeep(options.filters);
        filters[index] = filter;
        onChange(Object.assign(Object.assign({}, options), { filters }));
    }, [options, onChange]);
    const onChangeType = useCallback((type) => {
        onChange(Object.assign(Object.assign({}, options), { type: type !== null && type !== void 0 ? type : FilterByValueType.include }));
    }, [options, onChange]);
    const onChangeMatch = useCallback((match) => {
        onChange(Object.assign(Object.assign({}, options), { match: match !== null && match !== void 0 ? match : FilterByValueMatch.all }));
    }, [options, onChange]);
    return (React.createElement("div", null,
        React.createElement(InlineField, { label: "Filter type", labelWidth: 16 },
            React.createElement("div", { className: "width-15" },
                React.createElement(RadioButtonGroup, { options: filterTypes, value: options.type, onChange: onChangeType, fullWidth: true }))),
        React.createElement(InlineField, { label: "Conditions", labelWidth: 16 },
            React.createElement("div", { className: "width-15" },
                React.createElement(RadioButtonGroup, { options: filterMatch, value: options.match, onChange: onChangeMatch, fullWidth: true }))),
        React.createElement(Box, { paddingLeft: 2 },
            options.filters.map((filter, idx) => (React.createElement(FilterByValueFilterEditor, { key: idx, filter: filter, fieldsInfo: fieldsInfo, onChange: (filter) => onChangeFilter(filter, idx), onDelete: () => onDeleteFilter(idx) }))),
            React.createElement(Button, { icon: "plus", size: "sm", onClick: onAddFilter, variant: "secondary" }, "Add condition"))));
};
export const filterByValueTransformRegistryItem = {
    id: DataTransformerID.filterByValue,
    editor: FilterByValueTransformerEditor,
    transformation: standardTransformers.filterByValueTransformer,
    name: standardTransformers.filterByValueTransformer.name,
    description: 'Removes rows of the query results using user-defined filters. This is useful if you can not filter your data in the data source.',
    categories: new Set([TransformerCategory.Filter]),
};
const useFieldsInfo = (data) => {
    return useMemo(() => {
        const meta = {
            fieldsAsOptions: [],
            fieldByDisplayName: {},
        };
        if (!Array.isArray(data)) {
            return meta;
        }
        return data.reduce((meta, frame) => {
            return frame.fields.reduce((meta, field) => {
                const fieldName = getFieldDisplayName(field, frame, data);
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
//# sourceMappingURL=FilterByValueTransformerEditor.js.map