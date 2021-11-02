import { __assign, __makeTemplateObject, __read, __spreadArray } from "tslib";
import React, { useCallback } from 'react';
import { FALLBACK_COLOR, formattedValueToString, DataHoverClearEvent, DataHoverEvent, } from '@grafana/data';
import { useTheme2, useStyles2, DataLinksContextMenu, SeriesTable, usePanelContext, } from '@grafana/ui';
import { PieChartType, PieChartLabels } from './types';
import { useTooltip, useTooltipInPortal } from '@visx/tooltip';
import Pie from '@visx/shape/lib/shapes/Pie';
import { RadialGradient } from '@visx/gradient';
import { localPoint } from '@visx/event';
import { Group } from '@visx/group';
import tinycolor from 'tinycolor2';
import { css } from '@emotion/css';
import { useComponentInstanceId } from '@grafana/ui/src/utils/useComponetInstanceId';
import { getTooltipContainerStyles } from '@grafana/ui/src/themes/mixins';
import { selectors } from '@grafana/e2e-selectors';
import { filterDisplayItems, sumDisplayItemsReducer } from './utils';
export var PieChart = function (_a) {
    var fieldDisplayValues = _a.fieldDisplayValues, pieType = _a.pieType, width = _a.width, height = _a.height, highlightedTitle = _a.highlightedTitle, _b = _a.displayLabels, displayLabels = _b === void 0 ? [] : _b, tooltipOptions = _a.tooltipOptions;
    var theme = useTheme2();
    var componentInstanceId = useComponentInstanceId('PieChart');
    var styles = useStyles2(getStyles);
    var tooltip = useTooltip();
    var _c = useTooltipInPortal({
        detectBounds: true,
        scroll: true,
    }), containerRef = _c.containerRef, TooltipInPortal = _c.TooltipInPortal;
    var filteredFieldDisplayValues = fieldDisplayValues.filter(filterDisplayItems);
    var getValue = function (d) { return d.display.numeric; };
    var getGradientId = function (color) { return componentInstanceId + "-" + tinycolor(color).toHex(); };
    var getGradientColor = function (color) {
        return "url(#" + getGradientId(color) + ")";
    };
    var showLabel = displayLabels.length > 0;
    var showTooltip = tooltipOptions.mode !== 'none' && tooltip.tooltipOpen;
    var total = filteredFieldDisplayValues.reduce(sumDisplayItemsReducer, 0);
    var layout = getPieLayout(width, height, pieType);
    var colors = __spreadArray([], __read(new Set(filteredFieldDisplayValues.map(function (fieldDisplayValue) { var _a; return (_a = fieldDisplayValue.display.color) !== null && _a !== void 0 ? _a : FALLBACK_COLOR; }))), false);
    return (React.createElement("div", { className: styles.container },
        React.createElement("svg", { width: layout.size, height: layout.size, ref: containerRef },
            React.createElement(Group, { top: layout.position, left: layout.position },
                colors.map(function (color) {
                    return (React.createElement(RadialGradient, { key: color, id: getGradientId(color), from: getGradientColorFrom(color, theme), to: getGradientColorTo(color, theme), fromOffset: layout.gradientFromOffset, toOffset: "1", gradientUnits: "userSpaceOnUse", cx: 0, cy: 0, radius: layout.outerRadius }));
                }),
                React.createElement(Pie, { data: filteredFieldDisplayValues, pieValue: getValue, outerRadius: layout.outerRadius, innerRadius: layout.innerRadius, cornerRadius: 3, padAngle: 0.005 }, function (pie) { return (React.createElement(React.Fragment, null,
                    pie.arcs.map(function (arc) {
                        var _a;
                        var color = (_a = arc.data.display.color) !== null && _a !== void 0 ? _a : FALLBACK_COLOR;
                        var highlightState = getHighlightState(highlightedTitle, arc);
                        if (arc.data.hasLinks && arc.data.getLinks) {
                            return (React.createElement(DataLinksContextMenu, { config: arc.data.field, key: arc.index, links: arc.data.getLinks }, function (api) { return (React.createElement(PieSlice, { tooltip: tooltip, highlightState: highlightState, arc: arc, pie: pie, fill: getGradientColor(color), openMenu: api.openMenu, tooltipOptions: tooltipOptions })); }));
                        }
                        else {
                            return (React.createElement(PieSlice, { key: arc.index, highlightState: highlightState, tooltip: tooltip, arc: arc, pie: pie, fill: getGradientColor(color), tooltipOptions: tooltipOptions }));
                        }
                    }),
                    showLabel &&
                        pie.arcs.map(function (arc) {
                            var highlightState = getHighlightState(highlightedTitle, arc);
                            return (React.createElement(PieLabel, { arc: arc, key: arc.index, highlightState: highlightState, outerRadius: layout.outerRadius, innerRadius: layout.innerRadius, displayLabels: displayLabels, total: total, color: theme.colors.text.primary }));
                        }))); }))),
        showTooltip ? (React.createElement(TooltipInPortal, { key: Math.random(), top: tooltip.tooltipTop, className: styles.tooltipPortal, left: tooltip.tooltipLeft, unstyled: true, applyPositionStyle: true },
            React.createElement(SeriesTable, { series: tooltip.tooltipData }))) : null));
};
function PieSlice(_a) {
    var arc = _a.arc, pie = _a.pie, highlightState = _a.highlightState, openMenu = _a.openMenu, fill = _a.fill, tooltip = _a.tooltip, tooltipOptions = _a.tooltipOptions;
    var theme = useTheme2();
    var styles = useStyles2(getStyles);
    var eventBus = usePanelContext().eventBus;
    var onMouseOut = useCallback(function (event) {
        eventBus === null || eventBus === void 0 ? void 0 : eventBus.publish({
            type: DataHoverClearEvent.type,
            payload: {
                raw: event,
                x: 0,
                y: 0,
                dataId: arc.data.display.title,
            },
        });
        tooltip.hideTooltip();
    }, [eventBus, arc, tooltip]);
    var onMouseMoveOverArc = useCallback(function (event) {
        eventBus === null || eventBus === void 0 ? void 0 : eventBus.publish({
            type: DataHoverEvent.type,
            payload: {
                raw: event,
                x: 0,
                y: 0,
                dataId: arc.data.display.title,
            },
        });
        var coords = localPoint(event.target.ownerSVGElement, event);
        tooltip.showTooltip({
            tooltipLeft: coords.x,
            tooltipTop: coords.y,
            tooltipData: getTooltipData(pie, arc, tooltipOptions),
        });
    }, [eventBus, arc, tooltip, pie, tooltipOptions]);
    var pieStyle = getSvgStyle(highlightState, styles);
    return (React.createElement("g", { key: arc.data.display.title, className: pieStyle, onMouseMove: tooltipOptions.mode !== 'none' ? onMouseMoveOverArc : undefined, onMouseOut: onMouseOut, onClick: openMenu, "aria-label": selectors.components.Panels.Visualization.PieChart.svgSlice },
        React.createElement("path", { d: pie.path(__assign({}, arc)), fill: fill, stroke: theme.colors.background.primary, strokeWidth: 1 })));
}
function PieLabel(_a) {
    var arc = _a.arc, outerRadius = _a.outerRadius, innerRadius = _a.innerRadius, displayLabels = _a.displayLabels, total = _a.total, color = _a.color, highlightState = _a.highlightState;
    var styles = useStyles2(getStyles);
    var labelRadius = innerRadius === 0 ? outerRadius / 6 : innerRadius;
    var _b = __read(getLabelPos(arc, outerRadius, labelRadius), 2), labelX = _b[0], labelY = _b[1];
    var hasSpaceForLabel = arc.endAngle - arc.startAngle >= 0.3;
    if (!hasSpaceForLabel) {
        return null;
    }
    var labelFontSize = displayLabels.includes(PieChartLabels.Name)
        ? Math.min(Math.max((outerRadius / 150) * 14, 12), 30)
        : Math.min(Math.max((outerRadius / 100) * 14, 12), 36);
    return (React.createElement("g", { className: getSvgStyle(highlightState, styles) },
        React.createElement("text", { fill: color, x: labelX, y: labelY, dy: ".33em", fontSize: labelFontSize, fontWeight: 500, textAnchor: "middle", pointerEvents: "none" },
            displayLabels.includes(PieChartLabels.Name) && (React.createElement("tspan", { x: labelX, dy: "1.2em" }, arc.data.display.title)),
            displayLabels.includes(PieChartLabels.Value) && (React.createElement("tspan", { x: labelX, dy: "1.2em" }, formattedValueToString(arc.data.display))),
            displayLabels.includes(PieChartLabels.Percent) && (React.createElement("tspan", { x: labelX, dy: "1.2em" }, ((arc.data.display.numeric / total) * 100).toFixed(0) + '%')))));
}
function getTooltipData(pie, arc, tooltipOptions) {
    var _a;
    if (tooltipOptions.mode === 'multi') {
        return pie.arcs.map(function (pieArc) {
            var _a;
            return {
                color: (_a = pieArc.data.display.color) !== null && _a !== void 0 ? _a : FALLBACK_COLOR,
                label: pieArc.data.display.title,
                value: formattedValueToString(pieArc.data.display),
                isActive: pieArc.index === arc.index,
            };
        });
    }
    return [
        {
            color: (_a = arc.data.display.color) !== null && _a !== void 0 ? _a : FALLBACK_COLOR,
            label: arc.data.display.title,
            value: formattedValueToString(arc.data.display),
        },
    ];
}
function getLabelPos(arc, outerRadius, innerRadius) {
    var r = (outerRadius + innerRadius) / 2;
    var a = (+arc.startAngle + +arc.endAngle) / 2 - Math.PI / 2;
    return [Math.cos(a) * r, Math.sin(a) * r];
}
function getGradientColorFrom(color, theme) {
    return tinycolor(color)
        .darken(20 * (theme.isDark ? 1 : -0.7))
        .spin(4)
        .toRgbString();
}
function getGradientColorTo(color, theme) {
    return tinycolor(color)
        .darken(10 * (theme.isDark ? 1 : -0.7))
        .spin(-4)
        .toRgbString();
}
function getPieLayout(height, width, pieType, margin) {
    if (margin === void 0) { margin = 16; }
    var size = Math.min(width, height);
    var outerRadius = (size - margin * 2) / 2;
    var donutThickness = pieType === PieChartType.Pie ? outerRadius : Math.max(outerRadius / 3, 20);
    var innerRadius = outerRadius - donutThickness;
    var centerOffset = (size - margin * 2) / 2;
    // for non donut pie charts shift gradient out a bit
    var gradientFromOffset = 1 - (outerRadius - innerRadius) / outerRadius;
    return {
        position: centerOffset + margin,
        size: size,
        outerRadius: outerRadius,
        innerRadius: innerRadius,
        gradientFromOffset: gradientFromOffset,
    };
}
var HighLightState;
(function (HighLightState) {
    HighLightState[HighLightState["Highlighted"] = 0] = "Highlighted";
    HighLightState[HighLightState["Deemphasized"] = 1] = "Deemphasized";
    HighLightState[HighLightState["Normal"] = 2] = "Normal";
})(HighLightState || (HighLightState = {}));
function getHighlightState(highlightedTitle, arc) {
    if (highlightedTitle) {
        if (highlightedTitle === arc.data.display.title) {
            return HighLightState.Highlighted;
        }
        else {
            return HighLightState.Deemphasized;
        }
    }
    return HighLightState.Normal;
}
function getSvgStyle(highlightState, styles) {
    switch (highlightState) {
        case HighLightState.Highlighted:
            return styles.svgArg.highlighted;
        case HighLightState.Deemphasized:
            return styles.svgArg.deemphasized;
        case HighLightState.Normal:
        default:
            return styles.svgArg.normal;
    }
}
var getStyles = function (theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      width: 100%;\n      height: 100%;\n      display: flex;\n      align-items: center;\n      justify-content: center;\n    "], ["\n      width: 100%;\n      height: 100%;\n      display: flex;\n      align-items: center;\n      justify-content: center;\n    "]))),
        svgArg: {
            normal: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n        transition: all 200ms ease-in-out;\n      "], ["\n        transition: all 200ms ease-in-out;\n      "]))),
            highlighted: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n        transition: all 200ms ease-in-out;\n        transform: scale3d(1.03, 1.03, 1);\n      "], ["\n        transition: all 200ms ease-in-out;\n        transform: scale3d(1.03, 1.03, 1);\n      "]))),
            deemphasized: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n        transition: all 200ms ease-in-out;\n        fill-opacity: 0.5;\n      "], ["\n        transition: all 200ms ease-in-out;\n        fill-opacity: 0.5;\n      "]))),
        },
        tooltipPortal: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      ", "\n    "], ["\n      ", "\n    "])), getTooltipContainerStyles(theme)),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=PieChart.js.map