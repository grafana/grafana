import { __assign } from "tslib";
import React, { useMemo } from 'react';
import { TooltipPlugin, useTheme2, ZoomPlugin } from '@grafana/ui';
import { TimelineChart } from '../state-timeline/TimelineChart';
import { TimelineMode } from '../state-timeline/types';
import { prepareTimelineFields, prepareTimelineLegendItems } from '../state-timeline/utils';
/**
 * @alpha
 */
export var StatusHistoryPanel = function (_a) {
    var data = _a.data, timeRange = _a.timeRange, timeZone = _a.timeZone, options = _a.options, width = _a.width, height = _a.height, onChangeTimeRange = _a.onChangeTimeRange;
    var theme = useTheme2();
    var _b = useMemo(function () { return prepareTimelineFields(data === null || data === void 0 ? void 0 : data.series, false, theme); }, [data, theme]), frames = _b.frames, warn = _b.warn;
    var legendItems = useMemo(function () { return prepareTimelineLegendItems(frames, options.legend, theme); }, [
        frames,
        options.legend,
        theme,
    ]);
    if (!frames || warn) {
        return (React.createElement("div", { className: "panel-empty" },
            React.createElement("p", null, warn !== null && warn !== void 0 ? warn : 'No data found in response')));
    }
    // Status grid requires some space between values
    if (frames[0].length > width / 2) {
        return (React.createElement("div", { className: "panel-empty" },
            React.createElement("p", null,
                "Too many points to visualize properly. ",
                React.createElement("br", null),
                "Update the query to return fewer points. ",
                React.createElement("br", null),
                "(",
                frames[0].length,
                " points recieved)")));
    }
    return (React.createElement(TimelineChart, __assign({ theme: theme, frames: frames, structureRev: data.structureRev, timeRange: timeRange, timeZone: timeZone, width: width, height: height, legendItems: legendItems }, options, { 
        // hardcoded
        mode: TimelineMode.Samples }), function (config, alignedFrame) {
        return (React.createElement(React.Fragment, null,
            React.createElement(ZoomPlugin, { config: config, onZoom: onChangeTimeRange }),
            React.createElement(TooltipPlugin, { data: alignedFrame, config: config, mode: options.tooltip.mode, timeZone: timeZone })));
    }));
};
//# sourceMappingURL=StatusHistoryPanel.js.map