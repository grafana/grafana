import React, { useMemo, useRef, useState } from 'react';
import { compareDataFrameStructures, FieldColorModeId, FieldType, getFieldDisplayName, VizOrientation, } from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import { SortOrder } from '@grafana/schema';
import { GraphGradientMode, GraphNG, measureText, PlotLegend, Portal, StackingMode, TooltipDisplayMode, UPLOT_AXIS_FONT_SIZE, usePanelContext, useTheme2, VizLayout, VizLegend, VizTooltipContainer, } from '@grafana/ui';
import { addTooltipSupport } from '@grafana/ui/src/components/uPlot/config/addTooltipSupport';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
import { getFieldLegendItem } from 'app/core/components/TimelineChart/utils';
import { DataHoverView } from 'app/features/visualization/data-hover/DataHoverView';
import { prepareBarChartDisplayValues, preparePlotConfigBuilder } from './utils';
const TOOLTIP_OFFSET = 10;
const propsToDiff = [
    'orientation',
    'barWidth',
    'barRadius',
    'xTickLabelRotation',
    'xTickLabelMaxLength',
    'xTickLabelSpacing',
    'groupWidth',
    'stacking',
    'showValue',
    'xField',
    'colorField',
    'legend',
    (prev, next) => { var _a, _b; return ((_a = next.text) === null || _a === void 0 ? void 0 : _a.valueSize) === ((_b = prev.text) === null || _b === void 0 ? void 0 : _b.valueSize); },
];
export const BarChartPanel = ({ data, options, fieldConfig, width, height, timeZone, id }) => {
    var _a, _b;
    const theme = useTheme2();
    const { eventBus } = usePanelContext();
    const oldConfig = useRef(undefined);
    const isToolTipOpen = useRef(false);
    const [hover, setHover] = useState(undefined);
    const [coords, setCoords] = useState(null);
    const [focusedSeriesIdx, setFocusedSeriesIdx] = useState(null);
    const [focusedPointIdx, setFocusedPointIdx] = useState(null);
    const [isActive, setIsActive] = useState(false);
    const [shouldDisplayCloseButton, setShouldDisplayCloseButton] = useState(false);
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
    const frame0Ref = useRef();
    const colorByFieldRef = useRef();
    const info = useMemo(() => prepareBarChartDisplayValues(data.series, theme, options), [data.series, theme, options]);
    const chartDisplay = 'viz' in info ? info : null;
    colorByFieldRef.current = chartDisplay === null || chartDisplay === void 0 ? void 0 : chartDisplay.colorByField;
    const structureRef = useRef(10000);
    useMemo(() => {
        structureRef.current++;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [options]); // change every time the options object changes (while editing)
    const structureRev = useMemo(() => {
        var _a;
        const f0 = chartDisplay === null || chartDisplay === void 0 ? void 0 : chartDisplay.viz[0];
        const f1 = frame0Ref.current;
        if (!(f0 && f1 && compareDataFrameStructures(f0, f1, true))) {
            structureRef.current++;
        }
        frame0Ref.current = f0;
        return ((_a = data.structureRev) !== null && _a !== void 0 ? _a : 0) + structureRef.current;
    }, [chartDisplay, data.structureRev]);
    const orientation = useMemo(() => {
        if (!options.orientation || options.orientation === VizOrientation.Auto) {
            return width < height ? VizOrientation.Horizontal : VizOrientation.Vertical;
        }
        return options.orientation;
    }, [width, height, options.orientation]);
    const xTickLabelMaxLength = useMemo(() => {
        // If no max length is set, limit the number of characters to a length where it will use a maximum of half of the height of the viz.
        if (!options.xTickLabelMaxLength) {
            const rotationAngle = options.xTickLabelRotation;
            const textSize = measureText('M', UPLOT_AXIS_FONT_SIZE).width; // M is usually the widest character so let's use that as an approximation.
            const maxHeightForValues = height / 2;
            return (maxHeightForValues /
                (Math.sin(((rotationAngle >= 0 ? rotationAngle : rotationAngle * -1) * Math.PI) / 180) * textSize) -
                3 //Subtract 3 for the "..." added to the end.
            );
        }
        else {
            return options.xTickLabelMaxLength;
        }
    }, [height, options.xTickLabelRotation, options.xTickLabelMaxLength]);
    if ('warn' in info) {
        return (React.createElement(PanelDataErrorView, { panelId: id, fieldConfig: fieldConfig, data: data, message: info.warn, needsNumberField: true }));
    }
    const renderTooltip = (alignedFrame, seriesIdx, datapointIdx) => {
        const field = seriesIdx == null ? null : alignedFrame.fields[seriesIdx];
        if (field) {
            const disp = getFieldDisplayName(field, alignedFrame);
            seriesIdx = info.aligned.fields.findIndex((f) => disp === getFieldDisplayName(f, info.aligned));
        }
        const tooltipMode = options.fullHighlight && options.stacking !== StackingMode.None ? TooltipDisplayMode.Multi : options.tooltip.mode;
        const tooltipSort = options.tooltip.mode === TooltipDisplayMode.Multi ? options.tooltip.sort : SortOrder.None;
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
            React.createElement(DataHoverView, { data: info.aligned, rowIndex: datapointIdx, columnIndex: seriesIdx, sortOrder: tooltipSort, mode: tooltipMode })));
    };
    const renderLegend = (config) => {
        const { legend } = options;
        if (!config || legend.showLegend === false) {
            return null;
        }
        if (info.colorByField) {
            const items = getFieldLegendItem([info.colorByField], theme);
            if (items === null || items === void 0 ? void 0 : items.length) {
                return (React.createElement(VizLayout.Legend, { placement: legend.placement },
                    React.createElement(VizLegend, { placement: legend.placement, items: items, displayMode: legend.displayMode })));
            }
        }
        return React.createElement(PlotLegend, Object.assign({ data: [info.legend], config: config, maxHeight: "35%", maxWidth: "60%" }, options.legend));
    };
    const rawValue = (seriesIdx, valueIdx) => {
        return frame0Ref.current.fields[seriesIdx].values[valueIdx];
    };
    // Color by value
    let getColor = undefined;
    let fillOpacity = 1;
    if (info.colorByField) {
        const colorByField = info.colorByField;
        const disp = colorByField.display;
        fillOpacity = ((_a = colorByField.config.custom.fillOpacity) !== null && _a !== void 0 ? _a : 100) / 100;
        // gradientMode? ignore?
        getColor = (seriesIdx, valueIdx) => { var _a; return disp((_a = colorByFieldRef.current) === null || _a === void 0 ? void 0 : _a.values[valueIdx]).color; };
    }
    else {
        const hasPerBarColor = frame0Ref.current.fields.some((f) => {
            var _a, _b, _c;
            const fromThresholds = ((_a = f.config.custom) === null || _a === void 0 ? void 0 : _a.gradientMode) === GraphGradientMode.Scheme &&
                ((_b = f.config.color) === null || _b === void 0 ? void 0 : _b.mode) === FieldColorModeId.Thresholds;
            return (fromThresholds ||
                ((_c = f.config.mappings) === null || _c === void 0 ? void 0 : _c.some((m) => {
                    // ValueToText mappings have a different format, where all of them are grouped into an object keyed by value
                    if (m.type === 'value') {
                        // === MappingType.ValueToText
                        return Object.values(m.options).some((result) => result.color != null);
                    }
                    return m.options.result.color != null;
                })));
        });
        if (hasPerBarColor) {
            // use opacity from first numeric field
            let opacityField = frame0Ref.current.fields.find((f) => f.type === FieldType.number);
            fillOpacity = ((_b = opacityField.config.custom.fillOpacity) !== null && _b !== void 0 ? _b : 100) / 100;
            getColor = (seriesIdx, valueIdx) => {
                let field = frame0Ref.current.fields[seriesIdx];
                return field.display(field.values[valueIdx]).color;
            };
        }
    }
    const prepConfig = (alignedFrame, allFrames, getTimeRange) => {
        const { barWidth, barRadius = 0, showValue, groupWidth, stacking, legend, tooltip, text, xTickLabelRotation, xTickLabelSpacing, fullHighlight, } = options;
        return preparePlotConfigBuilder({
            frame: alignedFrame,
            getTimeRange,
            timeZone,
            theme,
            timeZones: [timeZone],
            eventBus,
            orientation,
            barWidth,
            barRadius,
            showValue,
            groupWidth,
            xTickLabelRotation,
            xTickLabelMaxLength,
            xTickLabelSpacing,
            stacking,
            legend,
            tooltip,
            text,
            rawValue,
            getColor,
            fillOpacity,
            allFrames: info.viz,
            fullHighlight,
        });
    };
    return (React.createElement(GraphNG, { theme: theme, frames: info.viz, prepConfig: prepConfig, propsToDiff: propsToDiff, preparePlotFrame: (f) => f[0], renderLegend: renderLegend, legend: options.legend, timeZone: timeZone, timeRange: { from: 1, to: 1 }, structureRev: structureRev, width: width, height: height }, (config) => {
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
        if (options.tooltip.mode === TooltipDisplayMode.None) {
            return null;
        }
        return (React.createElement(Portal, null, hover && coords && focusedSeriesIdx && (React.createElement(VizTooltipContainer, { position: { x: coords.viewport.x, y: coords.viewport.y }, offset: { x: TOOLTIP_OFFSET, y: TOOLTIP_OFFSET }, allowPointerEvents: isToolTipOpen.current }, renderTooltip(info.viz[0], focusedSeriesIdx, focusedPointIdx)))));
    }));
};
//# sourceMappingURL=BarChartPanel.js.map