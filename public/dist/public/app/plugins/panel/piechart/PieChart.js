import { css } from '@emotion/css';
import { localPoint } from '@visx/event';
import { RadialGradient } from '@visx/gradient';
import { Group } from '@visx/group';
import Pie from '@visx/shape/lib/shapes/Pie';
import { useTooltip, useTooltipInPortal } from '@visx/tooltip';
import React, { useCallback } from 'react';
import tinycolor from 'tinycolor2';
import { FALLBACK_COLOR, formattedValueToString, DataHoverClearEvent, DataHoverEvent, } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useTheme2, useStyles2, DataLinksContextMenu, SeriesTable, usePanelContext, } from '@grafana/ui';
import { getTooltipContainerStyles } from '@grafana/ui/src/themes/mixins';
import { useComponentInstanceId } from '@grafana/ui/src/utils/useComponetInstanceId';
import { PieChartType, PieChartLabels } from './panelcfg.gen';
import { filterDisplayItems, sumDisplayItemsReducer } from './utils';
export const PieChart = ({ fieldDisplayValues, pieType, width, height, highlightedTitle, displayLabels = [], tooltipOptions, }) => {
    const theme = useTheme2();
    const componentInstanceId = useComponentInstanceId('PieChart');
    const styles = useStyles2(getStyles);
    const tooltip = useTooltip();
    const { containerRef, TooltipInPortal } = useTooltipInPortal({
        detectBounds: true,
        scroll: true,
    });
    const filteredFieldDisplayValues = fieldDisplayValues.filter(filterDisplayItems);
    const getValue = (d) => d.display.numeric;
    const getGradientId = (color) => `${componentInstanceId}-${tinycolor(color).toHex()}`;
    const getGradientColor = (color) => {
        return `url(#${getGradientId(color)})`;
    };
    const showLabel = displayLabels.length > 0;
    const showTooltip = tooltipOptions.mode !== 'none' && tooltip.tooltipOpen;
    const total = filteredFieldDisplayValues.reduce(sumDisplayItemsReducer, 0);
    const layout = getPieLayout(width, height, pieType);
    const colors = [
        ...new Set(filteredFieldDisplayValues.map((fieldDisplayValue) => { var _a; return (_a = fieldDisplayValue.display.color) !== null && _a !== void 0 ? _a : FALLBACK_COLOR; })),
    ];
    return (React.createElement("div", { className: styles.container },
        React.createElement("svg", { width: layout.size, height: layout.size, ref: containerRef, style: { overflow: 'visible' } },
            React.createElement(Group, { top: layout.position, left: layout.position },
                colors.map((color) => {
                    return (React.createElement(RadialGradient, { key: color, id: getGradientId(color), from: getGradientColorFrom(color, theme), to: getGradientColorTo(color, theme), fromOffset: layout.gradientFromOffset, toOffset: "1", gradientUnits: "userSpaceOnUse", cx: 0, cy: 0, radius: layout.outerRadius }));
                }),
                React.createElement(Pie, { data: filteredFieldDisplayValues, pieValue: getValue, outerRadius: layout.outerRadius, innerRadius: layout.innerRadius, cornerRadius: 3, padAngle: 0.005 }, (pie) => (React.createElement(React.Fragment, null,
                    pie.arcs.map((arc) => {
                        var _a;
                        const color = (_a = arc.data.display.color) !== null && _a !== void 0 ? _a : FALLBACK_COLOR;
                        const highlightState = getHighlightState(highlightedTitle, arc);
                        if (arc.data.hasLinks && arc.data.getLinks) {
                            return (React.createElement(DataLinksContextMenu, { key: arc.index, links: arc.data.getLinks }, (api) => (React.createElement(PieSlice, { tooltip: tooltip, highlightState: highlightState, arc: arc, pie: pie, fill: getGradientColor(color), openMenu: api.openMenu, tooltipOptions: tooltipOptions }))));
                        }
                        else {
                            return (React.createElement(PieSlice, { key: arc.index, highlightState: highlightState, tooltip: tooltip, arc: arc, pie: pie, fill: getGradientColor(color), tooltipOptions: tooltipOptions }));
                        }
                    }),
                    showLabel &&
                        pie.arcs.map((arc) => {
                            const highlightState = getHighlightState(highlightedTitle, arc);
                            return (React.createElement(PieLabel, { arc: arc, key: arc.index, highlightState: highlightState, outerRadius: layout.outerRadius, innerRadius: layout.innerRadius, displayLabels: displayLabels, total: total, color: theme.colors.text.primary }));
                        })))))),
        showTooltip ? (React.createElement(TooltipInPortal, { key: Math.random(), top: tooltip.tooltipTop, className: styles.tooltipPortal, left: tooltip.tooltipLeft, unstyled: true, applyPositionStyle: true },
            React.createElement(SeriesTable, { series: tooltip.tooltipData }))) : null));
};
function PieSlice({ arc, pie, highlightState, openMenu, fill, tooltip, tooltipOptions }) {
    const theme = useTheme2();
    const styles = useStyles2(getStyles);
    const { eventBus } = usePanelContext();
    const onMouseOut = useCallback((event) => {
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
    const onMouseMoveOverArc = useCallback((event) => {
        eventBus === null || eventBus === void 0 ? void 0 : eventBus.publish({
            type: DataHoverEvent.type,
            payload: {
                raw: event,
                x: 0,
                y: 0,
                dataId: arc.data.display.title,
            },
        });
        const owner = event.currentTarget.ownerSVGElement;
        if (owner) {
            const coords = localPoint(owner, event);
            tooltip.showTooltip({
                tooltipLeft: coords.x,
                tooltipTop: coords.y,
                tooltipData: getTooltipData(pie, arc, tooltipOptions),
            });
        }
    }, [eventBus, arc, tooltip, pie, tooltipOptions]);
    const pieStyle = getSvgStyle(highlightState, styles);
    return (React.createElement("g", { key: arc.data.display.title, className: pieStyle, onMouseMove: tooltipOptions.mode !== 'none' ? onMouseMoveOverArc : undefined, onMouseOut: onMouseOut, onClick: openMenu, "aria-label": selectors.components.Panels.Visualization.PieChart.svgSlice },
        React.createElement("path", { d: pie.path(Object.assign({}, arc)), fill: fill, stroke: theme.colors.background.primary, strokeWidth: 1 })));
}
function PieLabel({ arc, outerRadius, innerRadius, displayLabels, total, color, highlightState }) {
    var _a;
    const styles = useStyles2(getStyles);
    const labelRadius = innerRadius === 0 ? outerRadius / 6 : innerRadius;
    const [labelX, labelY] = getLabelPos(arc, outerRadius, labelRadius);
    const hasSpaceForLabel = arc.endAngle - arc.startAngle >= 0.3;
    if (!hasSpaceForLabel) {
        return null;
    }
    let labelFontSize = displayLabels.includes(PieChartLabels.Name)
        ? Math.min(Math.max((outerRadius / 150) * 14, 12), 30)
        : Math.min(Math.max((outerRadius / 100) * 14, 12), 36);
    return (React.createElement("g", { className: getSvgStyle(highlightState, styles) },
        React.createElement("text", { fill: color, x: labelX, y: labelY, dy: ".33em", fontSize: labelFontSize, fontWeight: 500, textAnchor: "middle", pointerEvents: "none" },
            displayLabels.includes(PieChartLabels.Name) && (React.createElement("tspan", { x: labelX, dy: "1.2em" }, arc.data.display.title)),
            displayLabels.includes(PieChartLabels.Value) && (React.createElement("tspan", { x: labelX, dy: "1.2em" }, formattedValueToString(arc.data.display))),
            displayLabels.includes(PieChartLabels.Percent) && (React.createElement("tspan", { x: labelX, dy: "1.2em" }, ((arc.data.display.numeric / total) * 100).toFixed((_a = arc.data.field.decimals) !== null && _a !== void 0 ? _a : 0) + '%')))));
}
function getTooltipData(pie, arc, tooltipOptions) {
    var _a;
    if (tooltipOptions.mode === 'multi') {
        return pie.arcs
            .filter((pa) => {
            var _a, _b, _c, _d;
            const field = pa.data.field;
            return field && !((_b = (_a = field.custom) === null || _a === void 0 ? void 0 : _a.hideFrom) === null || _b === void 0 ? void 0 : _b.tooltip) && !((_d = (_c = field.custom) === null || _c === void 0 ? void 0 : _c.hideFrom) === null || _d === void 0 ? void 0 : _d.viz);
        })
            .map((pieArc) => {
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
    const r = (outerRadius + innerRadius) / 2;
    const a = (+arc.startAngle + +arc.endAngle) / 2 - Math.PI / 2;
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
function getPieLayout(height, width, pieType, margin = 16) {
    const size = Math.min(width, height);
    const outerRadius = (size - margin * 2) / 2;
    const donutThickness = pieType === PieChartType.Pie ? outerRadius : Math.max(outerRadius / 3, 20);
    const innerRadius = outerRadius - donutThickness;
    const centerOffset = (size - margin * 2) / 2;
    // for non donut pie charts shift gradient out a bit
    const gradientFromOffset = 1 - (outerRadius - innerRadius) / outerRadius;
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
const getStyles = (theme) => {
    return {
        container: css `
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    `,
        svgArg: {
            normal: css `
        transition: all 200ms ease-in-out;
      `,
            highlighted: css `
        transition: all 200ms ease-in-out;
        transform: scale3d(1.03, 1.03, 1);
      `,
            deemphasized: css `
        transition: all 200ms ease-in-out;
        fill-opacity: 0.5;
      `,
        },
        tooltipPortal: css `
      ${getTooltipContainerStyles(theme)}
    `,
    };
};
//# sourceMappingURL=PieChart.js.map