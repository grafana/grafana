import { isEqual } from 'lodash';
import React, { useEffect, useState } from 'react';
import { EditorList } from '@grafana/experimental';
import { MultiFilterItem } from './MultiFilterItem';
const multiFiltersToFilterConditions = (filters) => Object.keys(filters).map((key) => ({ key, value: filters[key], operator: '=' }));
const filterConditionsToMultiFilters = (filters) => {
    const res = {};
    filters.forEach(({ key, value }) => {
        if (key && value) {
            res[key] = value;
        }
    });
    return res;
};
export const MultiFilter = ({ filters, onChange, keyPlaceholder }) => {
    const [items, setItems] = useState([]);
    useEffect(() => setItems(filters ? multiFiltersToFilterConditions(filters) : []), [filters]);
    const onFiltersChange = (newItems) => {
        setItems(newItems);
        // The onChange event should only be triggered in the case there is a complete dimension object.
        // So when a new key is added that does not yet have a value, it should not trigger an onChange event.
        const newMultifilters = filterConditionsToMultiFilters(newItems);
        if (!isEqual(newMultifilters, filters)) {
            onChange(newMultifilters);
        }
    };
    return React.createElement(EditorList, { items: items, onChange: onFiltersChange, renderItem: makeRenderFilter(keyPlaceholder) });
};
function makeRenderFilter(keyPlaceholder) {
    function renderFilter(item, onChange, onDelete) {
        return (React.createElement(MultiFilterItem, { filter: item, onChange: (item) => onChange(item), onDelete: onDelete, keyPlaceholder: keyPlaceholder }));
    }
    return renderFilter;
}
//# sourceMappingURL=MultiFilter.js.map