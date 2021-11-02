import { __read } from "tslib";
import { colorManipulator, FieldColorModeId, ThresholdsMode, } from '@grafana/data';
import tinycolor from 'tinycolor2';
import { getCanvasContext } from '../../../utils/measureText';
export function getOpacityGradientFn(color, opacity) {
    return function (plot, seriesIdx) {
        var ctx = getCanvasContext();
        var gradient = ctx.createLinearGradient(0, plot.bbox.top, 0, plot.bbox.top + plot.bbox.height);
        gradient.addColorStop(0, colorManipulator.alpha(color, opacity));
        gradient.addColorStop(1, colorManipulator.alpha(color, 0));
        return gradient;
    };
}
export function getHueGradientFn(color, opacity, theme) {
    return function (plot, seriesIdx) {
        var ctx = getCanvasContext();
        var gradient = ctx.createLinearGradient(0, plot.bbox.top, 0, plot.bbox.top + plot.bbox.height);
        var color1 = tinycolor(color).spin(-15);
        var color2 = tinycolor(color).spin(15);
        if (theme.isDark) {
            gradient.addColorStop(0, color2.lighten(10).setAlpha(opacity).toString());
            gradient.addColorStop(1, color1.darken(10).setAlpha(opacity).toString());
        }
        else {
            gradient.addColorStop(0, color2.lighten(10).setAlpha(opacity).toString());
            gradient.addColorStop(1, color1.setAlpha(opacity).toString());
        }
        return gradient;
    };
}
export var GradientDirection;
(function (GradientDirection) {
    GradientDirection[GradientDirection["Right"] = 0] = "Right";
    GradientDirection[GradientDirection["Up"] = 1] = "Up";
})(GradientDirection || (GradientDirection = {}));
export function scaleGradient(u, scaleKey, dir, scaleStops, discrete) {
    if (discrete === void 0) { discrete = false; }
    var scale = u.scales[scaleKey];
    // we want the stop below or at the scaleMax
    // and the stop below or at the scaleMin, else the stop above scaleMin
    var minStopIdx = null;
    var maxStopIdx = null;
    for (var i = 0; i < scaleStops.length; i++) {
        var stopVal = scaleStops[i][0];
        if (stopVal <= scale.min || minStopIdx == null) {
            minStopIdx = i;
        }
        maxStopIdx = i;
        if (stopVal >= scale.max) {
            break;
        }
    }
    if (minStopIdx === maxStopIdx) {
        return scaleStops[minStopIdx][1];
    }
    var minStopVal = scaleStops[minStopIdx][0];
    var maxStopVal = scaleStops[maxStopIdx][0];
    if (minStopVal === -Infinity) {
        minStopVal = scale.min;
    }
    if (maxStopVal === Infinity) {
        maxStopVal = scale.max;
    }
    var minStopPos = Math.round(u.valToPos(minStopVal, scaleKey, true));
    var maxStopPos = Math.round(u.valToPos(maxStopVal, scaleKey, true));
    var range = minStopPos - maxStopPos;
    var x0, y0, x1, y1;
    if (dir === GradientDirection.Up) {
        x0 = x1 = 0;
        y0 = minStopPos;
        y1 = maxStopPos;
    }
    else {
        y0 = y1 = 0;
        x0 = minStopPos;
        x1 = maxStopPos;
    }
    var ctx = getCanvasContext();
    var grd = ctx.createLinearGradient(x0, y0, x1, y1);
    var prevColor;
    for (var i = minStopIdx; i <= maxStopIdx; i++) {
        var s = scaleStops[i];
        var stopPos = i === minStopIdx ? minStopPos : i === maxStopIdx ? maxStopPos : Math.round(u.valToPos(s[0], scaleKey, true));
        var pct = (minStopPos - stopPos) / range;
        if (discrete && i > minStopIdx) {
            grd.addColorStop(pct, prevColor);
        }
        grd.addColorStop(pct, (prevColor = s[1]));
    }
    return grd;
}
export function getDataRange(plot, scaleKey) {
    var sc = plot.scales[scaleKey];
    var min = Infinity;
    var max = -Infinity;
    plot.series.forEach(function (ser, seriesIdx) {
        if (ser.show && ser.scale === scaleKey) {
            // uPlot skips finding data min/max when a scale has a pre-defined range
            if (ser.min == null) {
                var data = plot.data[seriesIdx];
                for (var i = 0; i < data.length; i++) {
                    if (data[i] != null) {
                        min = Math.min(min, data[i]);
                        max = Math.max(max, data[i]);
                    }
                }
            }
            else {
                min = Math.min(min, ser.min);
                max = Math.max(max, ser.max);
            }
        }
    });
    if (max === min) {
        min = sc.min;
        max = sc.max;
    }
    return [min, max];
}
export function getGradientRange(u, scaleKey, hardMin, hardMax, softMin, softMax) {
    var _a, _b, _c, _d;
    var min = (_a = hardMin !== null && hardMin !== void 0 ? hardMin : softMin) !== null && _a !== void 0 ? _a : null;
    var max = (_b = hardMax !== null && hardMax !== void 0 ? hardMax : softMax) !== null && _b !== void 0 ? _b : null;
    if (min == null || max == null) {
        var _e = __read(getDataRange(u, scaleKey), 2), dataMin = _e[0], dataMax = _e[1];
        min = (_c = min !== null && min !== void 0 ? min : dataMin) !== null && _c !== void 0 ? _c : 0;
        max = (_d = max !== null && max !== void 0 ? max : dataMax) !== null && _d !== void 0 ? _d : 100;
    }
    return [min, max];
}
export function getScaleGradientFn(opacity, theme, colorMode, thresholds, hardMin, hardMax, softMin, softMax) {
    if (!colorMode) {
        throw Error('Missing colorMode required for color scheme gradients');
    }
    if (!thresholds) {
        throw Error('Missing thresholds required for color scheme gradients');
    }
    return function (plot, seriesIdx) {
        var scaleKey = plot.series[seriesIdx].scale;
        var gradient = '';
        if (colorMode.id === FieldColorModeId.Thresholds) {
            if (thresholds.mode === ThresholdsMode.Absolute) {
                var valueStops = thresholds.steps.map(function (step) {
                    return [step.value, colorManipulator.alpha(theme.visualization.getColorByName(step.color), opacity)];
                });
                gradient = scaleGradient(plot, scaleKey, GradientDirection.Up, valueStops, true);
            }
            else {
                var _a = __read(getGradientRange(plot, scaleKey, hardMin, hardMax, softMin, softMax), 2), min_1 = _a[0], max = _a[1];
                var range_1 = max - min_1;
                var valueStops = thresholds.steps.map(function (step) {
                    return [
                        min_1 + range_1 * (step.value / 100),
                        colorManipulator.alpha(theme.visualization.getColorByName(step.color), opacity),
                    ];
                });
                gradient = scaleGradient(plot, scaleKey, GradientDirection.Up, valueStops, true);
            }
        }
        else if (colorMode.getColors) {
            var colors_1 = colorMode.getColors(theme);
            var _b = __read(getGradientRange(plot, scaleKey, hardMin, hardMax, softMin, softMax), 2), min_2 = _b[0], max = _b[1];
            var range_2 = max - min_2;
            var valueStops = colors_1.map(function (color, i) {
                return [
                    min_2 + range_2 * (i / (colors_1.length - 1)),
                    colorManipulator.alpha(theme.visualization.getColorByName(color), opacity),
                ];
            });
            gradient = scaleGradient(plot, scaleKey, GradientDirection.Up, valueStops, false);
        }
        return gradient;
    };
}
//# sourceMappingURL=gradientFills.js.map