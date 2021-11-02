import { __assign } from "tslib";
import React, { useCallback, useMemo } from 'react';
import { TooltipPlugin, useTheme2, ZoomPlugin } from '@grafana/ui';
import { TimelineMode } from './types';
import { TimelineChart } from './TimelineChart';
import { prepareTimelineFields, prepareTimelineLegendItems } from './utils';
import { StateTimelineTooltip } from './StateTimelineTooltip';
import { getLastStreamingDataFramePacket } from '@grafana/data/src/dataframe/StreamingDataFrame';
/**
 * @alpha
 */
export var StateTimelinePanel = function (_a) {
    var data = _a.data, timeRange = _a.timeRange, timeZone = _a.timeZone, options = _a.options, width = _a.width, height = _a.height, onChangeTimeRange = _a.onChangeTimeRange;
    var theme = useTheme2();
    var _b = useMemo(function () { var _a; return prepareTimelineFields(data === null || data === void 0 ? void 0 : data.series, (_a = options.mergeValues) !== null && _a !== void 0 ? _a : true, theme); }, [
        data,
        options.mergeValues,
        theme,
    ]), frames = _b.frames, warn = _b.warn;
    var legendItems = useMemo(function () { return prepareTimelineLegendItems(frames, options.legend, theme); }, [
        frames,
        options.legend,
        theme,
    ]);
    var renderCustomTooltip = useCallback(function (alignedData, seriesIdx, datapointIdx) {
        var _a, _b;
        var data = frames !== null && frames !== void 0 ? frames : [];
        // Not caring about multi mode in StateTimeline
        if (seriesIdx === null || datapointIdx === null) {
            return null;
        }
        /**
         * There could be a case when the tooltip shows a data from one of a multiple query and the other query finishes first
         * from refreshing. This causes data to be out of sync. alignedData - 1 because Time field doesn't count.
         * Render nothing in this case to prevent error.
         * See https://github.com/grafana/support-escalations/issues/932
         */
        if ((!((_b = (_a = alignedData.meta) === null || _a === void 0 ? void 0 : _a.transformations) === null || _b === void 0 ? void 0 : _b.length) && alignedData.fields.length - 1 !== data.length) ||
            !alignedData.fields[seriesIdx]) {
            return null;
        }
        return (React.createElement(StateTimelineTooltip, { data: data, alignedData: alignedData, seriesIdx: seriesIdx, datapointIdx: datapointIdx, timeZone: timeZone }));
    }, [timeZone, frames]);
    if (!frames || warn) {
        return (React.createElement("div", { className: "panel-empty" },
            React.createElement("p", null, warn !== null && warn !== void 0 ? warn : 'No data found in response')));
    }
    if (frames.length === 1) {
        var packet = getLastStreamingDataFramePacket(frames[0]);
        if (packet) {
            // console.log('STREAM Packet', packet);
        }
    }
    return (React.createElement(TimelineChart, __assign({ theme: theme, frames: frames, structureRev: data.structureRev, timeRange: timeRange, timeZone: timeZone, width: width, height: height, legendItems: legendItems }, options, { mode: TimelineMode.Changes }), function (config, alignedFrame) {
        return (React.createElement(React.Fragment, null,
            React.createElement(ZoomPlugin, { config: config, onZoom: onChangeTimeRange }),
            React.createElement(TooltipPlugin, { data: alignedFrame, config: config, mode: options.tooltip.mode, timeZone: timeZone, renderTooltip: renderCustomTooltip })));
    }));
};
//# sourceMappingURL=StateTimelinePanel.js.map