import { __assign, __extends } from "tslib";
import React, { PureComponent } from 'react';
import { compareDataFrameStructures, FieldType, getFieldColorModeForField, } from '@grafana/data';
import { AxisPlacement, GraphDrawStyle, VisibilityMode, ScaleDirection, ScaleOrientation, } from '@grafana/schema';
import { UPlotConfigBuilder } from '../uPlot/config/UPlotConfigBuilder';
import { UPlotChart } from '../uPlot/Plot';
import { preparePlotData } from '../uPlot/utils';
import { preparePlotFrame } from './utils';
import { isEqual } from 'lodash';
var defaultConfig = {
    drawStyle: GraphDrawStyle.Line,
    showPoints: VisibilityMode.Auto,
    axisPlacement: AxisPlacement.Hidden,
};
var Sparkline = /** @class */ (function (_super) {
    __extends(Sparkline, _super);
    function Sparkline(props) {
        var _this = _super.call(this, props) || this;
        var alignedDataFrame = preparePlotFrame(props.sparkline, props.config);
        _this.state = {
            data: preparePlotData([alignedDataFrame]),
            alignedDataFrame: alignedDataFrame,
            configBuilder: _this.prepareConfig(alignedDataFrame),
        };
        return _this;
    }
    Sparkline.getDerivedStateFromProps = function (props, state) {
        var frame = preparePlotFrame(props.sparkline, props.config);
        if (!frame) {
            return __assign({}, state);
        }
        return __assign(__assign({}, state), { data: preparePlotData([frame]), alignedDataFrame: frame });
    };
    Sparkline.prototype.componentDidUpdate = function (prevProps, prevState) {
        var alignedDataFrame = this.state.alignedDataFrame;
        if (!alignedDataFrame) {
            return;
        }
        var rebuildConfig = false;
        if (prevProps.sparkline !== this.props.sparkline) {
            rebuildConfig = !compareDataFrameStructures(this.state.alignedDataFrame, prevState.alignedDataFrame);
        }
        else {
            rebuildConfig = !isEqual(prevProps.config, this.props.config);
        }
        if (rebuildConfig) {
            this.setState({ configBuilder: this.prepareConfig(alignedDataFrame) });
        }
    };
    Sparkline.prototype.getYRange = function (field) {
        var _a, _b, _c;
        var _d = (_a = this.state.alignedDataFrame.fields[1].state) === null || _a === void 0 ? void 0 : _a.range, min = _d.min, max = _d.max;
        if (min === max) {
            if (min === 0) {
                max = 100;
            }
            else {
                min = 0;
                max *= 2;
            }
        }
        return [
            Math.max(min, (_b = field.config.min) !== null && _b !== void 0 ? _b : -Infinity),
            Math.min(max, (_c = field.config.max) !== null && _c !== void 0 ? _c : Infinity),
        ];
    };
    Sparkline.prototype.prepareConfig = function (data) {
        var _this = this;
        var _a, _b;
        var theme = this.props.theme;
        var builder = new UPlotConfigBuilder();
        builder.setCursor({
            show: false,
            x: false,
            y: false,
        });
        // X is the first field in the alligned frame
        var xField = data.fields[0];
        builder.addScale({
            scaleKey: 'x',
            orientation: ScaleOrientation.Horizontal,
            direction: ScaleDirection.Right,
            isTime: false,
            range: function () {
                var sparkline = _this.props.sparkline;
                if (sparkline.x) {
                    if (sparkline.timeRange && sparkline.x.type === FieldType.time) {
                        return [sparkline.timeRange.from.valueOf(), sparkline.timeRange.to.valueOf()];
                    }
                    var vals = sparkline.x.values;
                    return [vals.get(0), vals.get(vals.length - 1)];
                }
                return [0, sparkline.y.values.length - 1];
            },
        });
        builder.addAxis({
            scaleKey: 'x',
            theme: theme,
            placement: AxisPlacement.Hidden,
        });
        var _loop_1 = function (i) {
            var field = data.fields[i];
            var config = field.config;
            var customConfig = __assign(__assign({}, defaultConfig), config.custom);
            if (field === xField || field.type !== FieldType.number) {
                return "continue";
            }
            var scaleKey = config.unit || '__fixed';
            builder.addScale({
                scaleKey: scaleKey,
                orientation: ScaleOrientation.Vertical,
                direction: ScaleDirection.Up,
                range: function () { return _this.getYRange(field); },
            });
            builder.addAxis({
                scaleKey: scaleKey,
                theme: theme,
                placement: AxisPlacement.Hidden,
            });
            var colorMode = getFieldColorModeForField(field);
            var seriesColor = colorMode.getCalculator(field, theme)(0, 0);
            var pointsMode = customConfig.drawStyle === GraphDrawStyle.Points ? VisibilityMode.Always : customConfig.showPoints;
            builder.addSeries({
                pxAlign: false,
                scaleKey: scaleKey,
                theme: theme,
                drawStyle: customConfig.drawStyle,
                lineColor: (_a = customConfig.lineColor) !== null && _a !== void 0 ? _a : seriesColor,
                lineWidth: customConfig.lineWidth,
                lineInterpolation: customConfig.lineInterpolation,
                showPoints: pointsMode,
                pointSize: customConfig.pointSize,
                fillOpacity: customConfig.fillOpacity,
                fillColor: (_b = customConfig.fillColor) !== null && _b !== void 0 ? _b : seriesColor,
            });
        };
        for (var i = 0; i < data.fields.length; i++) {
            _loop_1(i);
        }
        return builder;
    };
    Sparkline.prototype.render = function () {
        var _a = this.state, data = _a.data, configBuilder = _a.configBuilder;
        var _b = this.props, width = _b.width, height = _b.height, sparkline = _b.sparkline;
        return (React.createElement(UPlotChart, { data: data, config: configBuilder, width: width, height: height, timeRange: sparkline.timeRange }));
    };
    return Sparkline;
}(PureComponent));
export { Sparkline };
//# sourceMappingURL=Sparkline.js.map