import { __assign } from "tslib";
import React, { useMemo } from 'react';
import { TooltipDisplayMode, StackingMode } from '@grafana/schema';
import { VizOrientation } from '@grafana/data';
import { TooltipPlugin, useTheme2 } from '@grafana/ui';
import { BarChart } from './BarChart';
import { prepareGraphableFrames } from './utils';
/**
 * @alpha
 */
export var BarChartPanel = function (_a) {
    var data = _a.data, options = _a.options, width = _a.width, height = _a.height, timeZone = _a.timeZone;
    var theme = useTheme2();
    var _b = useMemo(function () { return prepareGraphableFrames(data === null || data === void 0 ? void 0 : data.series, theme, options); }, [data, theme, options]), frames = _b.frames, warn = _b.warn;
    var orientation = useMemo(function () {
        if (!options.orientation || options.orientation === VizOrientation.Auto) {
            return width < height ? VizOrientation.Horizontal : VizOrientation.Vertical;
        }
        return options.orientation;
    }, [width, height, options.orientation]);
    // Force 'multi' tooltip setting or stacking mode
    var tooltip = useMemo(function () {
        if (options.stacking === StackingMode.Normal || options.stacking === StackingMode.Percent) {
            return __assign(__assign({}, options.tooltip), { mode: TooltipDisplayMode.Multi });
        }
        return options.tooltip;
    }, [options.tooltip, options.stacking]);
    if (!frames || warn) {
        return (React.createElement("div", { className: "panel-empty" },
            React.createElement("p", null, warn !== null && warn !== void 0 ? warn : 'No data found in response')));
    }
    return (React.createElement(BarChart, __assign({ frames: frames, timeZone: timeZone, timeRange: { from: 1, to: 1 }, structureRev: data.structureRev, width: width, height: height }, options, { orientation: orientation }), function (config, alignedFrame) {
        return React.createElement(TooltipPlugin, { data: alignedFrame, config: config, mode: tooltip.mode, timeZone: timeZone });
    }));
};
//# sourceMappingURL=BarChartPanel.js.map