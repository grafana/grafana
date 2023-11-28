import { isEqual } from 'lodash';
import React, { useMemo, useState } from 'react';
import { EditorList } from '@grafana/experimental';
import { FilterItem } from './FilterItem';
const dimensionsToFilterConditions = (dimensions) => Object.entries(dimensions !== null && dimensions !== void 0 ? dimensions : {}).reduce((acc, [key, value]) => {
    if (!value) {
        return acc;
    }
    // Previously, we only appended to the `acc`umulated dimensions if the value was a string.
    // However, Cloudwatch can present dimensions with single-value arrays, e.g.
    //   k: FunctionName
    //   v: ['MyLambdaFunction']
    // in which case we grab the single-value from the Array and use that as the value.
    let v = '';
    if (typeof value === 'string') {
        v = value;
    }
    else if (Array.isArray(value) && typeof value[0] === 'string') {
        v = value[0];
    }
    if (!v) {
        return acc;
    }
    const filter = {
        key: key,
        value: v,
        operator: '=',
    };
    return [...acc, filter];
}, []);
const filterConditionsToDimensions = (filters) => {
    return filters.reduce((acc, { key, value }) => {
        if (key && value) {
            return Object.assign(Object.assign({}, acc), { [key]: value });
        }
        return acc;
    }, {});
};
export const Dimensions = ({ metricStat, datasource, dimensionKeys, disableExpressions, onChange }) => {
    const dimensionFilters = useMemo(() => dimensionsToFilterConditions(metricStat.dimensions), [metricStat.dimensions]);
    const [items, setItems] = useState(dimensionFilters);
    const onDimensionsChange = (newItems) => {
        setItems(newItems);
        // The onChange event should only be triggered in the case there is a complete dimension object.
        // So when a new key is added that does not yet have a value, it should not trigger an onChange event.
        const newDimensions = filterConditionsToDimensions(newItems);
        if (!isEqual(newDimensions, metricStat.dimensions)) {
            onChange(newDimensions);
        }
    };
    return (React.createElement(EditorList, { items: items, onChange: onDimensionsChange, renderItem: makeRenderFilter(datasource, metricStat, dimensionKeys, disableExpressions) }));
};
function makeRenderFilter(datasource, metricStat, dimensionKeys, disableExpressions) {
    function renderFilter(item, onChange, onDelete) {
        return (React.createElement(FilterItem, { filter: item, onChange: (item) => onChange(item), datasource: datasource, metricStat: metricStat, disableExpressions: disableExpressions, dimensionKeys: dimensionKeys, onDelete: onDelete }));
    }
    return renderFilter;
}
//# sourceMappingURL=Dimensions.js.map