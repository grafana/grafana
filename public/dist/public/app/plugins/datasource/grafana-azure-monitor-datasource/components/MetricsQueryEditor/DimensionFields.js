import React, { useMemo } from 'react';
import { Button, Select, Input, HorizontalGroup, VerticalGroup, InlineLabel } from '@grafana/ui';
import { Field } from '../Field';
import { appendDimensionFilter, removeDimensionFilter, setDimensionFilterValue } from './setQueryValue';
var DimensionFields = function (_a) {
    var _b;
    var query = _a.query, dimensionOptions = _a.dimensionOptions, onQueryChange = _a.onQueryChange;
    var dimensionFilters = useMemo(function () { var _a, _b; return (_b = (_a = query.azureMonitor) === null || _a === void 0 ? void 0 : _a.dimensionFilters) !== null && _b !== void 0 ? _b : []; }, [
        (_b = query.azureMonitor) === null || _b === void 0 ? void 0 : _b.dimensionFilters,
    ]);
    var addFilter = function () {
        onQueryChange(appendDimensionFilter(query));
    };
    var removeFilter = function (index) {
        onQueryChange(removeDimensionFilter(query, index));
    };
    var onFieldChange = function (filterIndex, fieldName, value) {
        onQueryChange(setDimensionFilterValue(query, filterIndex, fieldName, value));
    };
    var onFilterInputChange = function (index, ev) {
        if (ev.target instanceof HTMLInputElement) {
            onFieldChange(index, 'filter', ev.target.value);
        }
    };
    return (React.createElement(Field, { label: "Dimension" },
        React.createElement(VerticalGroup, { spacing: "xs" },
            dimensionFilters.map(function (filter, index) { return (React.createElement(HorizontalGroup, { key: index, spacing: "xs" },
                React.createElement(Select, { menuShouldPortal: true, placeholder: "Field", value: filter.dimension, options: dimensionOptions, onChange: function (v) { var _a; return onFieldChange(index, 'dimension', (_a = v.value) !== null && _a !== void 0 ? _a : ''); }, width: 38 }),
                React.createElement(InlineLabel, { "aria-label": "equals" }, "=="),
                React.createElement(Input, { placeholder: "", value: filter.filter, onChange: function (ev) { return onFilterInputChange(index, ev); } }),
                React.createElement(Button, { variant: "secondary", size: "md", icon: "trash-alt", "aria-label": "Remove", onClick: function () { return removeFilter(index); } }))); }),
            React.createElement(Button, { variant: "secondary", size: "md", onClick: addFilter }, "Add new dimension"))));
};
export default DimensionFields;
//# sourceMappingURL=DimensionFields.js.map