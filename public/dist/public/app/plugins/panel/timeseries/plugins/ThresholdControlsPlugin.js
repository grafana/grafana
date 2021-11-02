import { __assign, __read, __spreadArray } from "tslib";
import React, { useState, useLayoutEffect, useMemo, useRef } from 'react';
import { getValueFormat } from '@grafana/data';
import { FIXED_UNIT } from '@grafana/ui';
import { ThresholdDragHandle } from './ThresholdDragHandle';
var GUTTER_SIZE = 60;
export var ThresholdControlsPlugin = function (_a) {
    var config = _a.config, fieldConfig = _a.fieldConfig, onThresholdsChange = _a.onThresholdsChange;
    var plotInstance = useRef();
    var _b = __read(useState(0), 2), renderToken = _b[0], setRenderToken = _b[1];
    useLayoutEffect(function () {
        config.setPadding([0, GUTTER_SIZE, 0, 0]);
        config.addHook('init', function (u) {
            plotInstance.current = u;
        });
        // render token required to re-render handles when resizing uPlot
        config.addHook('draw', function () {
            setRenderToken(function (s) { return s + 1; });
        });
    }, [config]);
    var thresholdHandles = useMemo(function () {
        var _a;
        var plot = plotInstance.current;
        if (!plot) {
            return null;
        }
        var thresholds = fieldConfig.defaults.thresholds;
        if (!thresholds) {
            return null;
        }
        var scale = (_a = fieldConfig.defaults.unit) !== null && _a !== void 0 ? _a : FIXED_UNIT;
        var decimals = fieldConfig.defaults.decimals;
        var handles = [];
        var _loop_1 = function (i) {
            var step = thresholds.steps[i];
            var yPos = plot.valToPos(step.value, scale);
            if (Number.isNaN(yPos) || !Number.isFinite(yPos)) {
                return "continue";
            }
            if (yPos < 0 || yPos > plot.bbox.height / window.devicePixelRatio) {
                return "continue";
            }
            var handle = (React.createElement(ThresholdDragHandle, { key: step.value + "-" + i, step: step, y: yPos, dragBounds: { top: 0, bottom: plot.bbox.height / window.devicePixelRatio }, mapPositionToValue: function (y) { return plot.posToVal(y, scale); }, formatValue: function (v) { return getValueFormat(scale)(v, decimals).text; }, onChange: function (value) {
                    var nextSteps = __spreadArray(__spreadArray(__spreadArray([], __read(thresholds.steps.slice(0, i)), false), __read(thresholds.steps.slice(i + 1)), false), [
                        __assign(__assign({}, thresholds.steps[i]), { value: value }),
                    ], false).sort(function (a, b) { return a.value - b.value; });
                    onThresholdsChange(__assign(__assign({}, thresholds), { steps: nextSteps }));
                } }));
            handles.push(handle);
        };
        for (var i = 0; i < thresholds.steps.length; i++) {
            _loop_1(i);
        }
        return handles;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [renderToken, fieldConfig, onThresholdsChange]);
    if (!plotInstance.current) {
        return null;
    }
    return (React.createElement("div", { style: {
            position: 'absolute',
            overflow: 'visible',
            left: (plotInstance.current.bbox.left + plotInstance.current.bbox.width) / window.devicePixelRatio + "px",
            top: plotInstance.current.bbox.top / window.devicePixelRatio + "px",
            width: GUTTER_SIZE + "px",
            height: plotInstance.current.bbox.height / window.devicePixelRatio + "px",
        } }, thresholdHandles));
};
ThresholdControlsPlugin.displayName = 'ThresholdControlsPlugin';
//# sourceMappingURL=ThresholdControlsPlugin.js.map