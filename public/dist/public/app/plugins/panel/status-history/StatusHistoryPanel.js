import React, { useCallback, useMemo, useRef, useState } from 'react';
import { DashboardCursorSync, FieldType } from '@grafana/data';
import { Portal, TooltipDisplayMode, usePanelContext, useTheme2, VizTooltipContainer, ZoomPlugin, } from '@grafana/ui';
import { addTooltipSupport } from '@grafana/ui/src/components/uPlot/config/addTooltipSupport';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
import { TimelineChart } from 'app/core/components/TimelineChart/TimelineChart';
import { prepareTimelineFields, prepareTimelineLegendItems, TimelineMode, } from 'app/core/components/TimelineChart/utils';
import { OutsideRangePlugin } from '../timeseries/plugins/OutsideRangePlugin';
import { getTimezones } from '../timeseries/utils';
import { StatusHistoryTooltip } from './StatusHistoryTooltip';
const TOOLTIP_OFFSET = 10;
/**
 * @alpha
 */
export const StatusHistoryPanel = ({ data, timeRange, timeZone, options, width, height, onChangeTimeRange, }) => {
    const theme = useTheme2();
    const oldConfig = useRef(undefined);
    const isToolTipOpen = useRef(false);
    const [hover, setHover] = useState(undefined);
    const [coords, setCoords] = useState(null);
    const [focusedSeriesIdx, setFocusedSeriesIdx] = useState(null);
    const [focusedPointIdx, setFocusedPointIdx] = useState(null);
    const [isActive, setIsActive] = useState(false);
    const [shouldDisplayCloseButton, setShouldDisplayCloseButton] = useState(false);
    const { sync } = usePanelContext();
    const onCloseToolTip = () => {
        isToolTipOpen.current = false;
        setCoords(null);
        setShouldDisplayCloseButton(false);
    };
    const onUPlotClick = () => {
        isToolTipOpen.current = !isToolTipOpen.current;
        // Linking into useState required to re-render tooltip
        setShouldDisplayCloseButton(isToolTipOpen.current);
    };
    const { frames, warn } = useMemo(() => prepareTimelineFields(data.series, false, timeRange, theme), [data.series, timeRange, theme]);
    const legendItems = useMemo(() => prepareTimelineLegendItems(frames, options.legend, theme), [frames, options.legend, theme]);
    const renderCustomTooltip = useCallback((alignedData, seriesIdx, datapointIdx) => {
        var _a, _b;
        const data = frames !== null && frames !== void 0 ? frames : [];
        // Count value fields in the state-timeline-ready frame
        const valueFieldsCount = data.reduce((acc, frame) => acc + frame.fields.filter((field) => field.type !== FieldType.time).length, 0);
        // Not caring about multi mode in StatusHistory
        if (seriesIdx === null || datapointIdx === null) {
            return null;
        }
        /**
         * There could be a case when the tooltip shows a data from one of a multiple query and the other query finishes first
         * from refreshing. This causes data to be out of sync. alignedData - 1 because Time field doesn't count.
         * Render nothing in this case to prevent error.
         * See https://github.com/grafana/support-escalations/issues/932
         */
        if ((!((_b = (_a = alignedData.meta) === null || _a === void 0 ? void 0 : _a.transformations) === null || _b === void 0 ? void 0 : _b.length) && alignedData.fields.length - 1 !== valueFieldsCount) ||
            !alignedData.fields[seriesIdx]) {
            return null;
        }
        return (React.createElement(React.Fragment, null,
            shouldDisplayCloseButton && (React.createElement("div", { style: {
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'flex-end',
                } },
                React.createElement(CloseButton, { onClick: onCloseToolTip, style: {
                        position: 'relative',
                        top: 'auto',
                        right: 'auto',
                        marginRight: 0,
                    } }))),
            React.createElement(StatusHistoryTooltip, { data: data, alignedData: alignedData, seriesIdx: seriesIdx, datapointIdx: datapointIdx, timeZone: timeZone })));
    }, [timeZone, frames, shouldDisplayCloseButton]);
    const renderTooltip = (alignedFrame) => {
        if (options.tooltip.mode === TooltipDisplayMode.None) {
            return null;
        }
        if (focusedPointIdx === null || (!isActive && sync && sync() === DashboardCursorSync.Crosshair)) {
            return null;
        }
        return (React.createElement(Portal, null, hover && coords && focusedSeriesIdx && (React.createElement(VizTooltipContainer, { position: { x: coords.viewport.x, y: coords.viewport.y }, offset: { x: TOOLTIP_OFFSET, y: TOOLTIP_OFFSET }, allowPointerEvents: isToolTipOpen.current }, renderCustomTooltip(alignedFrame, focusedSeriesIdx, focusedPointIdx)))));
    };
    const timezones = useMemo(() => getTimezones(options.timezone, timeZone), [options.timezone, timeZone]);
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
                " points received)")));
    }
    return (React.createElement(TimelineChart, Object.assign({ theme: theme, frames: frames, structureRev: data.structureRev, timeRange: timeRange, timeZone: timezones, width: width, height: height, legendItems: legendItems }, options, { mode: TimelineMode.Samples }), (config, alignedFrame) => {
        if (oldConfig.current !== config) {
            oldConfig.current = addTooltipSupport({
                config,
                onUPlotClick,
                setFocusedSeriesIdx,
                setFocusedPointIdx,
                setCoords,
                setHover,
                isToolTipOpen,
                isActive,
                setIsActive,
            });
        }
        return (React.createElement(React.Fragment, null,
            React.createElement(ZoomPlugin, { config: config, onZoom: onChangeTimeRange }),
            renderTooltip(alignedFrame),
            React.createElement(OutsideRangePlugin, { config: config, onChangeTimeRange: onChangeTimeRange })));
    }));
};
//# sourceMappingURL=StatusHistoryPanel.js.map