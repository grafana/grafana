import { TIME_SERIES_TIME_FIELD_NAME, TIME_SERIES_VALUE_FIELD_NAME, } from '@grafana/data';
import { EventsCanvas, FIXED_UNIT } from '@grafana/ui';
import React, { useCallback, useLayoutEffect, useRef } from 'react';
import { ExemplarMarker } from './ExemplarMarker';
export var ExemplarsPlugin = function (_a) {
    var exemplars = _a.exemplars, timeZone = _a.timeZone, getFieldLinks = _a.getFieldLinks, config = _a.config;
    var plotInstance = useRef();
    useLayoutEffect(function () {
        config.addHook('init', function (u) {
            plotInstance.current = u;
        });
    }, [config]);
    var mapExemplarToXYCoords = useCallback(function (dataFrame, dataFrameFieldIndex) {
        var _a;
        var time = dataFrame.fields.find(function (f) { return f.name === TIME_SERIES_TIME_FIELD_NAME; });
        var value = dataFrame.fields.find(function (f) { return f.name === TIME_SERIES_VALUE_FIELD_NAME; });
        if (!time || !value || !plotInstance.current) {
            return undefined;
        }
        // Filter x, y scales out
        var yScale = (_a = Object.keys(plotInstance.current.scales).find(function (scale) { return !['x', 'y'].some(function (key) { return key === scale; }); })) !== null && _a !== void 0 ? _a : FIXED_UNIT;
        var yMin = plotInstance.current.scales[yScale].min;
        var yMax = plotInstance.current.scales[yScale].max;
        var y = value.values.get(dataFrameFieldIndex.fieldIndex);
        // To not to show exemplars outside of the graph we set the y value to min if it is smaller and max if it is bigger than the size of the graph
        if (yMin != null && y < yMin) {
            y = yMin;
        }
        if (yMax != null && y > yMax) {
            y = yMax;
        }
        return {
            x: plotInstance.current.valToPos(time.values.get(dataFrameFieldIndex.fieldIndex), 'x'),
            y: plotInstance.current.valToPos(y, yScale),
        };
    }, []);
    var renderMarker = useCallback(function (dataFrame, dataFrameFieldIndex) {
        return (React.createElement(ExemplarMarker, { timeZone: timeZone, getFieldLinks: getFieldLinks, dataFrame: dataFrame, dataFrameFieldIndex: dataFrameFieldIndex, config: config }));
    }, [config, timeZone, getFieldLinks]);
    return (React.createElement(EventsCanvas, { config: config, id: "exemplars", events: exemplars, renderEventMarker: renderMarker, mapEventToXYCoords: mapExemplarToXYCoords }));
};
//# sourceMappingURL=ExemplarsPlugin.js.map