import React from 'react';
import { SeriesTable } from '../../VizTooltip';
import { getMultiSeriesGraphHoverInfo } from '../utils';
import { getValueFromDimension } from '@grafana/data';
export var MultiModeGraphTooltip = function (_a) {
    var dimensions = _a.dimensions, activeDimensions = _a.activeDimensions, pos = _a.pos, timeZone = _a.timeZone;
    var activeSeriesIndex = null;
    // when no x-axis provided, skip rendering
    if (activeDimensions.xAxis === null) {
        return null;
    }
    if (activeDimensions.yAxis) {
        activeSeriesIndex = activeDimensions.yAxis[0];
    }
    // when not hovering over a point, time is undefined, and we use pos.x as time
    var time = activeDimensions.xAxis[1]
        ? getValueFromDimension(dimensions.xAxis, activeDimensions.xAxis[0], activeDimensions.xAxis[1])
        : pos.x;
    var hoverInfo = getMultiSeriesGraphHoverInfo(dimensions.yAxis.columns, dimensions.xAxis.columns, time, timeZone);
    var timestamp = hoverInfo.time;
    var series = hoverInfo.results.map(function (s, i) {
        return {
            color: s.color,
            label: s.label,
            value: s.value,
            isActive: activeSeriesIndex === i,
        };
    });
    return React.createElement(SeriesTable, { series: series, timestamp: timestamp });
};
MultiModeGraphTooltip.displayName = 'MultiModeGraphTooltip';
//# sourceMappingURL=MultiModeGraphTooltip.js.map