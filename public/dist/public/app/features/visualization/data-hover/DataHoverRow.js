import { __rest } from "tslib";
import React from 'react';
import { ArrayDataFrame } from '@grafana/data';
import { DataHoverView } from './DataHoverView';
export const DataHoverRow = ({ feature }) => {
    let data;
    let rowIndex = 0;
    if (!feature) {
        return null;
    }
    data = feature.get('frame');
    if (data) {
        rowIndex = feature.get('rowIndex');
    }
    else {
        const _a = feature.getProperties(), { geometry } = _a, properties = __rest(_a, ["geometry"]);
        data = new ArrayDataFrame([properties]);
    }
    return React.createElement(DataHoverView, { data: data, rowIndex: rowIndex });
};
//# sourceMappingURL=DataHoverRow.js.map