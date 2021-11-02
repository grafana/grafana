import { __assign, __extends } from "tslib";
import uPlot from 'uplot';
import { PlotConfigBuilder } from '../types';
import { ScaleDistribution } from '@grafana/schema';
import { isBooleanUnit } from '@grafana/data';
var UPlotScaleBuilder = /** @class */ (function (_super) {
    __extends(UPlotScaleBuilder, _super);
    function UPlotScaleBuilder() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    UPlotScaleBuilder.prototype.merge = function (props) {
        this.props.min = optMinMax('min', this.props.min, props.min);
        this.props.max = optMinMax('max', this.props.max, props.max);
    };
    UPlotScaleBuilder.prototype.getConfig = function () {
        var _a;
        var _b = this.props, isTime = _b.isTime, scaleKey = _b.scaleKey, hardMin = _b.min, hardMax = _b.max, softMin = _b.softMin, softMax = _b.softMax, range = _b.range, direction = _b.direction, orientation = _b.orientation;
        var distribution = !isTime
            ? {
                distr: this.props.distribution === ScaleDistribution.Log
                    ? 3
                    : this.props.distribution === ScaleDistribution.Ordinal
                        ? 2
                        : 1,
                log: this.props.distribution === ScaleDistribution.Log ? this.props.log || 2 : undefined,
            }
            : {};
        // uPlot's default ranging config for both min & max is {pad: 0.1, hard: null, soft: 0, mode: 3}
        var softMinMode = softMin == null ? 3 : 1;
        var softMaxMode = softMax == null ? 3 : 1;
        var rangeConfig = {
            min: {
                pad: 0.1,
                hard: hardMin !== null && hardMin !== void 0 ? hardMin : -Infinity,
                soft: softMin || 0,
                mode: softMinMode,
            },
            max: {
                pad: 0.1,
                hard: hardMax !== null && hardMax !== void 0 ? hardMax : Infinity,
                soft: softMax || 0,
                mode: softMaxMode,
            },
        };
        var hardMinOnly = softMin == null && hardMin != null;
        var hardMaxOnly = softMax == null && hardMax != null;
        // uPlot range function
        var rangeFn = function (u, dataMin, dataMax, scaleKey) {
            var _a;
            var scale = u.scales[scaleKey];
            var minMax = [dataMin, dataMax];
            if (scale.distr === 1 || scale.distr === 2) {
                // @ts-ignore here we may use hardMin / hardMax to make sure any extra padding is computed from a more accurate delta
                minMax = uPlot.rangeNum(hardMinOnly ? hardMin : dataMin, hardMaxOnly ? hardMax : dataMax, rangeConfig);
            }
            else if (scale.distr === 3) {
                minMax = uPlot.rangeLog(dataMin, dataMax, (_a = scale.log) !== null && _a !== void 0 ? _a : 10, true);
            }
            // if all we got were hard limits, treat them as static min/max
            if (hardMinOnly) {
                minMax[0] = hardMin;
            }
            if (hardMaxOnly) {
                minMax[1] = hardMax;
            }
            return minMax;
        };
        var auto = !isTime && !(hardMinOnly && hardMaxOnly);
        if (isBooleanUnit(scaleKey)) {
            auto = false;
            range = [0, 1];
        }
        return _a = {},
            _a[scaleKey] = __assign({ time: isTime, auto: auto, range: range !== null && range !== void 0 ? range : rangeFn, dir: direction, ori: orientation }, distribution),
            _a;
    };
    return UPlotScaleBuilder;
}(PlotConfigBuilder));
export { UPlotScaleBuilder };
export function optMinMax(minmax, a, b) {
    var hasA = !(a === undefined || a === null);
    var hasB = !(b === undefined || b === null);
    if (hasA) {
        if (!hasB) {
            return a;
        }
        if (minmax === 'min') {
            return a < b ? a : b;
        }
        return a > b ? a : b;
    }
    return b;
}
//# sourceMappingURL=UPlotScaleBuilder.js.map