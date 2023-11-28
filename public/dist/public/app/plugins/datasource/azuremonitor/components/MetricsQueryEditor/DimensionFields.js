import React, { useEffect, useMemo, useState } from 'react';
import { EditorList, AccessoryButton } from '@grafana/experimental';
import { Select, HorizontalGroup, MultiSelect } from '@grafana/ui';
import { Field } from '../Field';
import { setDimensionFilters } from './setQueryValue';
const useDimensionLabels = (data, query) => {
    const [dimensionLabels, setDimensionLabels] = useState({});
    useEffect(() => {
        var _a;
        let labelsObj = {};
        if ((_a = data === null || data === void 0 ? void 0 : data.series) === null || _a === void 0 ? void 0 : _a.length) {
            // Identify which series' in the dataframe are relevant to the current query
            const series = data.series.flat().filter((series) => series.refId === query.refId);
            const fields = series.flatMap((series) => series.fields);
            // Retrieve labels for series fields
            const labels = fields
                .map((fields) => fields.labels)
                .flat()
                .filter((item) => item !== null && item !== undefined);
            for (const label of labels) {
                // Labels only exist for series that have a dimension selected
                for (const [dimension, value] of Object.entries(label)) {
                    const dimensionLower = dimension.toLowerCase();
                    if (labelsObj[dimensionLower]) {
                        labelsObj[dimensionLower].add(value);
                    }
                    else {
                        labelsObj[dimensionLower] = new Set([value]);
                    }
                }
            }
        }
        setDimensionLabels((prevLabels) => {
            const newLabels = {};
            const currentLabels = Object.keys(labelsObj);
            if (currentLabels.length === 0) {
                return prevLabels;
            }
            for (const label of currentLabels) {
                if (prevLabels[label] && labelsObj[label].size < prevLabels[label].size) {
                    newLabels[label] = prevLabels[label];
                }
                else {
                    newLabels[label] = labelsObj[label];
                }
            }
            return newLabels;
        });
    }, [data === null || data === void 0 ? void 0 : data.series, query.refId]);
    return dimensionLabels;
};
const DimensionFields = ({ data, query, dimensionOptions, onQueryChange }) => {
    var _a;
    const dimensionFilters = useMemo(() => { var _a, _b; return (_b = (_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.dimensionFilters) !== null && _b !== void 0 ? _b : []; }, [(_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.dimensionFilters]);
    const dimensionLabels = useDimensionLabels(data, query);
    const dimensionOperators = [
        { label: '==', value: 'eq' },
        { label: '!=', value: 'ne' },
        { label: 'starts with', value: 'sw' },
    ];
    const validDimensionOptions = useMemo(() => {
        // We filter out any dimensions that have already been used in a filter as the API doesn't support having multiple filters with the same dimension name.
        // The Azure portal also doesn't support this feature so it makes sense for consistency.
        let t = dimensionOptions;
        if (dimensionFilters.length) {
            t = dimensionOptions.filter((val) => !dimensionFilters.some((dimensionFilter) => dimensionFilter.dimension === val.value));
        }
        return t;
    }, [dimensionFilters, dimensionOptions]);
    const onFieldChange = (fieldName, item, value, onChange) => {
        item[fieldName] = value;
        onChange(item);
    };
    const getValidDimensionOptions = (selectedDimension) => {
        return validDimensionOptions.concat(dimensionOptions.filter((item) => item.value === selectedDimension));
    };
    const getValidFilterOptions = (selectedFilter, dimension) => {
        var _a;
        const dimensionFilters = Array.from((_a = dimensionLabels[dimension.toLowerCase()]) !== null && _a !== void 0 ? _a : []);
        if (dimensionFilters.find((filter) => filter === selectedFilter)) {
            return dimensionFilters.map((filter) => ({ value: filter, label: filter }));
        }
        return [...dimensionFilters, ...(selectedFilter && selectedFilter !== '*' ? [selectedFilter] : [])].map((item) => ({
            value: item,
            label: item,
        }));
    };
    const getValidMultiSelectOptions = (selectedFilters, dimension) => {
        const labelOptions = getValidFilterOptions(undefined, dimension);
        if (selectedFilters) {
            for (const filter of selectedFilters) {
                if (!labelOptions.find((label) => label.value === filter)) {
                    labelOptions.push({ value: filter, label: filter });
                }
            }
        }
        return labelOptions;
    };
    const getValidOperators = (selectedOperator) => {
        if (dimensionOperators.find((operator) => operator.value === selectedOperator)) {
            return dimensionOperators;
        }
        return [...dimensionOperators, ...(selectedOperator ? [{ label: selectedOperator, value: selectedOperator }] : [])];
    };
    const changedFunc = (changed) => {
        const properData = changed.map((x) => {
            var _a, _b, _c;
            return {
                dimension: (_a = x.dimension) !== null && _a !== void 0 ? _a : '',
                operator: (_b = x.operator) !== null && _b !== void 0 ? _b : 'eq',
                filters: (_c = x.filters) !== null && _c !== void 0 ? _c : [],
            };
        });
        onQueryChange(setDimensionFilters(query, properData));
    };
    const renderFilters = (item, onChange, onDelete) => {
        var _a, _b;
        return (React.createElement(HorizontalGroup, { spacing: "none" },
            React.createElement(Select, { menuShouldPortal: true, placeholder: "Field", value: item.dimension, options: getValidDimensionOptions(item.dimension || ''), onChange: (e) => { var _a; return onFieldChange('dimension', item, (_a = e.value) !== null && _a !== void 0 ? _a : '', onChange); } }),
            React.createElement(Select, { menuShouldPortal: true, placeholder: "Operation", value: item.operator, options: getValidOperators(item.operator || 'eq'), onChange: (e) => { var _a; return onFieldChange('operator', item, (_a = e.value) !== null && _a !== void 0 ? _a : '', onChange); }, allowCustomValue: true }),
            item.operator === 'eq' || item.operator === 'ne' ? (React.createElement(MultiSelect, { menuShouldPortal: true, placeholder: "Select value(s)", value: item.filters, options: getValidMultiSelectOptions(item.filters, (_a = item.dimension) !== null && _a !== void 0 ? _a : ''), onChange: (e) => onFieldChange('filters', item, e.map((x) => { var _a; return (_a = x.value) !== null && _a !== void 0 ? _a : ''; }), onChange), "aria-label": 'dimension-labels-select', allowCustomValue: true })) : (
            // The API does not currently allow for multiple "starts with" clauses to be used.
            React.createElement(Select, { menuShouldPortal: true, placeholder: "Select value", value: item.filters ? item.filters[0] : '', allowCustomValue: true, options: getValidFilterOptions(item.filters ? item.filters[0] : '', (_b = item.dimension) !== null && _b !== void 0 ? _b : ''), onChange: (e) => { var _a; return onFieldChange('filters', item, [(_a = e === null || e === void 0 ? void 0 : e.value) !== null && _a !== void 0 ? _a : ''], onChange); }, isClearable: true })),
            React.createElement(AccessoryButton, { "aria-label": "Remove", icon: "times", variant: "secondary", onClick: onDelete, type: "button" })));
    };
    return (React.createElement(Field, { label: "Dimensions" },
        React.createElement(EditorList, { items: dimensionFilters, onChange: changedFunc, renderItem: renderFilters })));
};
export default DimensionFields;
//# sourceMappingURL=DimensionFields.js.map