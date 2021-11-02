import React, { useCallback, useContext } from 'react';
/** @alpha */
export var GraphNGContext = React.createContext({});
/**
 * @alpha
 * Exposes API for data frame inspection in Plot plugins
 */
export var useGraphNGContext = function () {
    var _a = useContext(GraphNGContext), data = _a.data, dimFields = _a.dimFields, mapSeriesIndexToDataFrameFieldIndex = _a.mapSeriesIndexToDataFrameFieldIndex;
    var getXAxisField = useCallback(function () {
        var xFieldMatcher = dimFields.x;
        var xField = null;
        for (var j = 0; j < data.fields.length; j++) {
            if (xFieldMatcher(data.fields[j], data, [data])) {
                xField = data.fields[j];
                break;
            }
        }
        return xField;
    }, [data, dimFields]);
    return {
        dimFields: dimFields,
        mapSeriesIndexToDataFrameFieldIndex: mapSeriesIndexToDataFrameFieldIndex,
        getXAxisField: getXAxisField,
        alignedData: data,
    };
};
//# sourceMappingURL=hooks.js.map