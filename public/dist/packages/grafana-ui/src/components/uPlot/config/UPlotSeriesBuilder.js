import { __assign, __extends } from "tslib";
import { colorManipulator, FALLBACK_COLOR, FieldColorModeId, } from '@grafana/data';
import uPlot from 'uplot';
import { GraphDrawStyle, GraphGradientMode, LineInterpolation, VisibilityMode, } from '@grafana/schema';
import { PlotConfigBuilder } from '../types';
import { getHueGradientFn, getOpacityGradientFn, getScaleGradientFn } from './gradientFills';
var UPlotSeriesBuilder = /** @class */ (function (_super) {
    __extends(UPlotSeriesBuilder, _super);
    function UPlotSeriesBuilder() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    UPlotSeriesBuilder.prototype.getConfig = function () {
        var _a;
        var _b = this.props, facets = _b.facets, drawStyle = _b.drawStyle, pathBuilder = _b.pathBuilder, pointsBuilder = _b.pointsBuilder, pointsFilter = _b.pointsFilter, lineInterpolation = _b.lineInterpolation, lineWidth = _b.lineWidth, lineStyle = _b.lineStyle, barAlignment = _b.barAlignment, barWidthFactor = _b.barWidthFactor, barMaxWidth = _b.barMaxWidth, showPoints = _b.showPoints, pointSize = _b.pointSize, scaleKey = _b.scaleKey, pxAlign = _b.pxAlign, spanNulls = _b.spanNulls, _c = _b.show, show = _c === void 0 ? true : _c;
        var lineConfig = {};
        var lineColor = this.getLineColor();
        // GraphDrawStyle.Points mode also needs this for fill/stroke sharing & re-use in series.points. see getColor() below.
        lineConfig.stroke = lineColor;
        if (pathBuilder != null) {
            lineConfig.paths = pathBuilder;
            lineConfig.width = lineWidth;
        }
        else if (drawStyle === GraphDrawStyle.Points) {
            lineConfig.paths = function () { return null; };
        }
        else if (drawStyle != null) {
            lineConfig.width = lineWidth;
            if (lineStyle && lineStyle.fill !== 'solid') {
                if (lineStyle.fill === 'dot') {
                    lineConfig.cap = 'round';
                }
                lineConfig.dash = (_a = lineStyle.dash) !== null && _a !== void 0 ? _a : [10, 10];
            }
            lineConfig.paths = function (self, seriesIdx, idx0, idx1) {
                var pathsBuilder = mapDrawStyleToPathBuilder(drawStyle, lineInterpolation, barAlignment, barWidthFactor, barMaxWidth);
                return pathsBuilder(self, seriesIdx, idx0, idx1);
            };
        }
        var useColor = 
        // @ts-ignore
        typeof lineColor === 'string' ? lineColor : function (u, seriesIdx) { return u.series[seriesIdx]._stroke; };
        var pointsConfig = {
            points: {
                stroke: useColor,
                fill: useColor,
                size: pointSize,
                filter: pointsFilter,
            },
        };
        if (pointsBuilder != null) {
            pointsConfig.points.show = pointsBuilder;
        }
        else {
            // we cannot set points.show property above (even to undefined) as that will clear uPlot's default auto behavior
            if (drawStyle === GraphDrawStyle.Points) {
                pointsConfig.points.show = true;
            }
            else {
                if (showPoints === VisibilityMode.Auto) {
                    if (drawStyle === GraphDrawStyle.Bars) {
                        pointsConfig.points.show = false;
                    }
                }
                else if (showPoints === VisibilityMode.Never) {
                    pointsConfig.points.show = false;
                }
                else if (showPoints === VisibilityMode.Always) {
                    pointsConfig.points.show = true;
                }
            }
        }
        return __assign(__assign({ scale: scaleKey, facets: facets, spanGaps: typeof spanNulls === 'number' ? false : spanNulls, value: function () { return ''; }, pxAlign: pxAlign, show: show, fill: this.getFill() }, lineConfig), pointsConfig);
    };
    UPlotSeriesBuilder.prototype.getLineColor = function () {
        var _a = this.props, lineColor = _a.lineColor, gradientMode = _a.gradientMode, colorMode = _a.colorMode, thresholds = _a.thresholds, theme = _a.theme, hardMin = _a.hardMin, hardMax = _a.hardMax, softMin = _a.softMin, softMax = _a.softMax;
        if (gradientMode === GraphGradientMode.Scheme && (colorMode === null || colorMode === void 0 ? void 0 : colorMode.id) !== FieldColorModeId.Fixed) {
            return getScaleGradientFn(1, theme, colorMode, thresholds, hardMin, hardMax, softMin, softMax);
        }
        return lineColor !== null && lineColor !== void 0 ? lineColor : FALLBACK_COLOR;
    };
    UPlotSeriesBuilder.prototype.getFill = function () {
        var _a = this.props, lineColor = _a.lineColor, fillColor = _a.fillColor, gradientMode = _a.gradientMode, fillOpacity = _a.fillOpacity, colorMode = _a.colorMode, thresholds = _a.thresholds, theme = _a.theme, hardMin = _a.hardMin, hardMax = _a.hardMax, softMin = _a.softMin, softMax = _a.softMax;
        if (fillColor) {
            return fillColor;
        }
        var mode = gradientMode !== null && gradientMode !== void 0 ? gradientMode : GraphGradientMode.None;
        var opacityPercent = (fillOpacity !== null && fillOpacity !== void 0 ? fillOpacity : 0) / 100;
        switch (mode) {
            case GraphGradientMode.Opacity:
                return getOpacityGradientFn((fillColor !== null && fillColor !== void 0 ? fillColor : lineColor), opacityPercent);
            case GraphGradientMode.Hue:
                return getHueGradientFn((fillColor !== null && fillColor !== void 0 ? fillColor : lineColor), opacityPercent, theme);
            case GraphGradientMode.Scheme:
                if ((colorMode === null || colorMode === void 0 ? void 0 : colorMode.id) !== FieldColorModeId.Fixed) {
                    return getScaleGradientFn(opacityPercent, theme, colorMode, thresholds, hardMin, hardMax, softMin, softMax);
                }
            // intentional fall-through to handle Scheme with Fixed color
            default:
                if (opacityPercent > 0) {
                    return colorManipulator.alpha(lineColor !== null && lineColor !== void 0 ? lineColor : '', opacityPercent);
                }
        }
        return undefined;
    };
    return UPlotSeriesBuilder;
}(PlotConfigBuilder));
export { UPlotSeriesBuilder };
var builders = undefined;
function mapDrawStyleToPathBuilder(style, lineInterpolation, barAlignment, barWidthFactor, barMaxWidth) {
    if (barAlignment === void 0) { barAlignment = 0; }
    if (barWidthFactor === void 0) { barWidthFactor = 0.6; }
    if (barMaxWidth === void 0) { barMaxWidth = Infinity; }
    var pathBuilders = uPlot.paths;
    if (!builders) {
        // This should be global static, but Jest initalization was failing so we lazy load to avoid the issue
        builders = {
            linear: pathBuilders.linear(),
            smooth: pathBuilders.spline(),
            stepBefore: pathBuilders.stepped({ align: -1 }),
            stepAfter: pathBuilders.stepped({ align: 1 }),
        };
    }
    if (style === GraphDrawStyle.Bars) {
        // each bars pathBuilder is lazy-initialized and globally cached by a key composed of its options
        var barsCfgKey = "bars|" + barAlignment + "|" + barWidthFactor + "|" + barMaxWidth;
        if (!builders[barsCfgKey]) {
            builders[barsCfgKey] = pathBuilders.bars({
                size: [barWidthFactor, barMaxWidth],
                align: barAlignment,
            });
        }
        return builders[barsCfgKey];
    }
    else if (style === GraphDrawStyle.Line) {
        if (lineInterpolation === LineInterpolation.StepBefore) {
            return builders.stepBefore;
        }
        if (lineInterpolation === LineInterpolation.StepAfter) {
            return builders.stepAfter;
        }
        if (lineInterpolation === LineInterpolation.Smooth) {
            return builders.smooth;
        }
    }
    return builders.linear; // the default
}
//# sourceMappingURL=UPlotSeriesBuilder.js.map