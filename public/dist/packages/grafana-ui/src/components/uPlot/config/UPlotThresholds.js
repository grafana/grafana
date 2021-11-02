import { __assign, __read } from "tslib";
import { ThresholdsMode } from '@grafana/data';
import { GraphTresholdsStyleMode } from '@grafana/schema';
import { getGradientRange, GradientDirection, scaleGradient } from './gradientFills';
import tinycolor from 'tinycolor2';
export function getThresholdsDrawHook(options) {
    return function (u) {
        var ctx = u.ctx;
        var scaleKey = options.scaleKey, thresholds = options.thresholds, theme = options.theme, config = options.config, hardMin = options.hardMin, hardMax = options.hardMax, softMin = options.softMin, softMax = options.softMax;
        var _a = u.scales.x, xMin = _a.min, xMax = _a.max;
        var _b = u.scales[scaleKey], yMin = _b.min, yMax = _b.max;
        if (xMin == null || xMax == null || yMin == null || yMax == null) {
            return;
        }
        var steps = thresholds.steps, mode = thresholds.mode;
        if (mode === ThresholdsMode.Percentage) {
            var _c = __read(getGradientRange(u, scaleKey, hardMin, hardMax, softMin, softMax), 2), min_1 = _c[0], max = _c[1];
            var range_1 = max - min_1;
            steps = steps.map(function (step) { return (__assign(__assign({}, step), { value: min_1 + range_1 * (step.value / 100) })); });
        }
        function addLines() {
            // Thresholds below a transparent threshold is treated like "less than", and line drawn previous threshold
            var transparentIndex = 0;
            for (var idx = 0; idx < steps.length; idx++) {
                var step = steps[idx];
                if (step.color === 'transparent') {
                    transparentIndex = idx;
                    break;
                }
            }
            // Ignore the base -Infinity threshold by always starting on index 1
            for (var idx = 1; idx < steps.length; idx++) {
                var step = steps[idx];
                var color = void 0;
                // if we are below a transparent index treat this a less then threshold, use previous thresholds color
                if (transparentIndex >= idx && idx > 0) {
                    color = tinycolor(theme.visualization.getColorByName(steps[idx - 1].color));
                }
                else {
                    color = tinycolor(theme.visualization.getColorByName(step.color));
                }
                // Unless alpha specififed set to default value
                if (color.getAlpha() === 1) {
                    color.setAlpha(0.7);
                }
                var x0 = Math.round(u.valToPos(xMin, 'x', true));
                var y0 = Math.round(u.valToPos(step.value, scaleKey, true));
                var x1 = Math.round(u.valToPos(xMax, 'x', true));
                var y1 = Math.round(u.valToPos(step.value, scaleKey, true));
                ctx.beginPath();
                ctx.lineWidth = 2;
                ctx.strokeStyle = color.toString();
                ctx.moveTo(x0, y0);
                ctx.lineTo(x1, y1);
                ctx.stroke();
                ctx.closePath();
            }
        }
        function addAreas() {
            var grd = scaleGradient(u, u.series[1].scale, GradientDirection.Up, steps.map(function (step) {
                var color = tinycolor(theme.visualization.getColorByName(step.color));
                if (color.getAlpha() === 1) {
                    color.setAlpha(0.15);
                }
                return [step.value, color.toString()];
            }), true);
            ctx.save();
            ctx.fillStyle = grd;
            ctx.fillRect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
            ctx.restore();
        }
        switch (config.mode) {
            case GraphTresholdsStyleMode.Line:
                addLines();
                break;
            case GraphTresholdsStyleMode.Area:
                addAreas();
                break;
            case GraphTresholdsStyleMode.LineAndArea:
                addLines();
                addAreas();
        }
    };
}
//# sourceMappingURL=UPlotThresholds.js.map