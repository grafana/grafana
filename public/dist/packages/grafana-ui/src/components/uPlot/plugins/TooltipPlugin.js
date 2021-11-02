import { __read, __rest } from "tslib";
import { DashboardCursorSync, FALLBACK_COLOR, FieldType, formattedValueToString, getDisplayProcessor, getFieldDisplayName, } from '@grafana/data';
import { TooltipDisplayMode } from '@grafana/schema';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { useMountedState } from 'react-use';
import { useTheme2 } from '../../../themes/ThemeContext';
import { Portal } from '../../Portal/Portal';
import { SeriesTable, VizTooltipContainer } from '../../VizTooltip';
import { findMidPointYPosition, pluginLog } from '../utils';
var TOOLTIP_OFFSET = 10;
/**
 * @alpha
 */
export var TooltipPlugin = function (_a) {
    var _b, _c, _d, _e;
    var _f = _a.mode, mode = _f === void 0 ? TooltipDisplayMode.Single : _f, sync = _a.sync, timeZone = _a.timeZone, config = _a.config, renderTooltip = _a.renderTooltip, otherProps = __rest(_a, ["mode", "sync", "timeZone", "config", "renderTooltip"]);
    var theme = useTheme2();
    var _g = __read(useState(null), 2), focusedSeriesIdx = _g[0], setFocusedSeriesIdx = _g[1];
    var _h = __read(useState(null), 2), focusedPointIdx = _h[0], setFocusedPointIdx = _h[1];
    var _j = __read(useState([]), 2), focusedPointIdxs = _j[0], setFocusedPointIdxs = _j[1];
    var _k = __read(useState(null), 2), coords = _k[0], setCoords = _k[1];
    var _l = __read(useState(false), 2), isActive = _l[0], setIsActive = _l[1];
    var isMounted = useMountedState();
    var pluginId = "TooltipPlugin";
    // Debug logs
    useEffect(function () {
        pluginLog(pluginId, true, "Focused series: " + focusedSeriesIdx + ", focused point: " + focusedPointIdx);
    }, [focusedPointIdx, focusedSeriesIdx]);
    // Add uPlot hooks to the config, or re-add when the config changed
    useLayoutEffect(function () {
        var plotInstance = undefined;
        var bbox = undefined;
        var plotMouseLeave = function () {
            if (!isMounted()) {
                return;
            }
            setCoords(null);
            setIsActive(false);
            plotInstance === null || plotInstance === void 0 ? void 0 : plotInstance.root.classList.remove('plot-active');
        };
        var plotMouseEnter = function () {
            if (!isMounted()) {
                return;
            }
            setIsActive(true);
            plotInstance === null || plotInstance === void 0 ? void 0 : plotInstance.root.classList.add('plot-active');
        };
        // cache uPlot plotting area bounding box
        config.addHook('syncRect', function (u, rect) {
            bbox = rect;
        });
        config.addHook('init', function (u) {
            plotInstance = u;
            u.over.addEventListener('mouseleave', plotMouseLeave);
            u.over.addEventListener('mouseenter', plotMouseEnter);
            if (sync === DashboardCursorSync.Crosshair) {
                u.root.classList.add('shared-crosshair');
            }
        });
        var tooltipInterpolator = config.getTooltipInterpolator();
        if (tooltipInterpolator) {
            // Custom toolitp positioning
            config.addHook('setCursor', function (u) {
                tooltipInterpolator(setFocusedSeriesIdx, setFocusedPointIdx, function (clear) {
                    if (clear) {
                        setCoords(null);
                        return;
                    }
                    if (!bbox) {
                        return;
                    }
                    var _a = positionTooltip(u, bbox), x = _a.x, y = _a.y;
                    if (x !== undefined && y !== undefined) {
                        setCoords({ x: x, y: y });
                    }
                }, u);
            });
        }
        else {
            config.addHook('setLegend', function (u) {
                if (!isMounted()) {
                    return;
                }
                setFocusedPointIdx(u.legend.idx);
                setFocusedPointIdxs(u.legend.idxs.slice());
            });
            // default series/datapoint idx retireval
            config.addHook('setCursor', function (u) {
                if (!bbox || !isMounted()) {
                    return;
                }
                var _a = positionTooltip(u, bbox), x = _a.x, y = _a.y;
                if (x !== undefined && y !== undefined) {
                    setCoords({ x: x, y: y });
                }
                else {
                    setCoords(null);
                }
            });
            config.addHook('setSeries', function (_, idx) {
                if (!isMounted()) {
                    return;
                }
                setFocusedSeriesIdx(idx);
            });
        }
        return function () {
            setCoords(null);
            if (plotInstance) {
                plotInstance.over.removeEventListener('mouseleave', plotMouseLeave);
                plotInstance.over.removeEventListener('mouseenter', plotMouseEnter);
            }
        };
    }, [config, setCoords, setIsActive, setFocusedPointIdx, setFocusedPointIdxs]);
    if (focusedPointIdx === null || (!isActive && sync === DashboardCursorSync.Crosshair)) {
        return null;
    }
    // GraphNG expects aligned data, let's take field 0 as x field. FTW
    var xField = otherProps.data.fields[0];
    if (!xField) {
        return null;
    }
    var xFieldFmt = xField.display || getDisplayProcessor({ field: xField, timeZone: timeZone, theme: theme });
    var tooltip = null;
    var xVal = xFieldFmt(xField.values.get(focusedPointIdx)).text;
    if (!renderTooltip) {
        // when interacting with a point in single mode
        if (mode === TooltipDisplayMode.Single && focusedSeriesIdx !== null) {
            var field = otherProps.data.fields[focusedSeriesIdx];
            if (!field) {
                return null;
            }
            var fieldFmt = field.display || getDisplayProcessor({ field: field, timeZone: timeZone, theme: theme });
            var display = fieldFmt(field.values.get(focusedPointIdx));
            tooltip = (React.createElement(SeriesTable, { series: [
                    {
                        color: display.color || FALLBACK_COLOR,
                        label: getFieldDisplayName(field, otherProps.data),
                        value: display ? formattedValueToString(display) : null,
                    },
                ], timestamp: xVal }));
        }
        if (mode === TooltipDisplayMode.Multi) {
            var series = [];
            var frame = otherProps.data;
            var fields = frame.fields;
            for (var i = 0; i < fields.length; i++) {
                var field = frame.fields[i];
                if (!field ||
                    field === xField ||
                    field.type === FieldType.time ||
                    field.type !== FieldType.number ||
                    ((_c = (_b = field.config.custom) === null || _b === void 0 ? void 0 : _b.hideFrom) === null || _c === void 0 ? void 0 : _c.tooltip) ||
                    ((_e = (_d = field.config.custom) === null || _d === void 0 ? void 0 : _d.hideFrom) === null || _e === void 0 ? void 0 : _e.viz)) {
                    continue;
                }
                var display = field.display(otherProps.data.fields[i].values.get(focusedPointIdxs[i]));
                series.push({
                    color: display.color || FALLBACK_COLOR,
                    label: getFieldDisplayName(field, frame),
                    value: display ? formattedValueToString(display) : null,
                    isActive: focusedSeriesIdx === i,
                });
            }
            tooltip = React.createElement(SeriesTable, { series: series, timestamp: xVal });
        }
    }
    else {
        tooltip = renderTooltip(otherProps.data, focusedSeriesIdx, focusedPointIdx);
    }
    return (React.createElement(Portal, null, tooltip && coords && (React.createElement(VizTooltipContainer, { position: { x: coords.x, y: coords.y }, offset: { x: TOOLTIP_OFFSET, y: TOOLTIP_OFFSET } }, tooltip))));
};
function isCursourOutsideCanvas(_a, canvas) {
    var left = _a.left, top = _a.top;
    if (left === undefined || top === undefined) {
        return false;
    }
    return left < 0 || left > canvas.width || top < 0 || top > canvas.height;
}
/**
 * Given uPlot cursor position, figure out position of the tooltip withing the canvas bbox
 * Tooltip is positioned relatively to a viewport
 * @internal
 **/
export function positionTooltip(u, bbox) {
    var x, y;
    var cL = u.cursor.left || 0;
    var cT = u.cursor.top || 0;
    if (isCursourOutsideCanvas(u.cursor, bbox)) {
        var idx = u.posToIdx(cL);
        // when cursor outside of uPlot's canvas
        if (cT < 0 || cT > bbox.height) {
            var pos = findMidPointYPosition(u, idx);
            if (pos) {
                y = bbox.top + pos;
                if (cL >= 0 && cL <= bbox.width) {
                    // find x-scale position for a current cursor left position
                    x = bbox.left + u.valToPos(u.data[0][u.posToIdx(cL)], u.series[0].scale);
                }
            }
        }
    }
    else {
        x = bbox.left + cL;
        y = bbox.top + cT;
    }
    return { x: x, y: y };
}
//# sourceMappingURL=TooltipPlugin.js.map