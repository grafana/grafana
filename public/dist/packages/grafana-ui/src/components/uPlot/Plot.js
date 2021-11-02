import { __assign, __extends } from "tslib";
import React, { createRef } from 'react';
import uPlot from 'uplot';
import { DEFAULT_PLOT_CONFIG, pluginLog } from './utils';
function sameDims(prevProps, nextProps) {
    return nextProps.width === prevProps.width && nextProps.height === prevProps.height;
}
function sameData(prevProps, nextProps) {
    return nextProps.data === prevProps.data;
}
function sameConfig(prevProps, nextProps) {
    return nextProps.config === prevProps.config;
}
function sameTimeRange(prevProps, nextProps) {
    var prevTime = prevProps.timeRange;
    var nextTime = nextProps.timeRange;
    return (prevTime === nextTime ||
        (nextTime.from.valueOf() === prevTime.from.valueOf() && nextTime.to.valueOf() === prevTime.to.valueOf()));
}
/**
 * @internal
 * uPlot abstraction responsible for plot initialisation, setup and refresh
 * Receives a data frame that is x-axis aligned, as of https://github.com/leeoniya/uPlot/tree/master/docs#data-format
 * Exposes context for uPlot instance access
 */
var UPlotChart = /** @class */ (function (_super) {
    __extends(UPlotChart, _super);
    function UPlotChart(props) {
        var _this = _super.call(this, props) || this;
        _this.plotContainer = createRef();
        _this.plotCanvasBBox = createRef();
        _this.state = {
            plot: null,
        };
        return _this;
    }
    UPlotChart.prototype.reinitPlot = function () {
        var _a;
        var _b = this.props, width = _b.width, height = _b.height, plotRef = _b.plotRef;
        (_a = this.state.plot) === null || _a === void 0 ? void 0 : _a.destroy();
        if (width === 0 && height === 0) {
            return;
        }
        this.props.config.addHook('setSize', function (u) {
            var canvas = u.over;
            if (!canvas) {
                return;
            }
        });
        var config = __assign(__assign(__assign({}, DEFAULT_PLOT_CONFIG), { width: this.props.width, height: this.props.height, ms: 1 }), this.props.config.getConfig());
        pluginLog('UPlot', false, 'Reinitializing plot', config);
        var plot = new uPlot(config, this.props.data, this.plotContainer.current);
        if (plotRef) {
            plotRef(plot);
        }
        this.setState({ plot: plot });
    };
    UPlotChart.prototype.componentDidMount = function () {
        this.reinitPlot();
    };
    UPlotChart.prototype.componentWillUnmount = function () {
        var _a;
        (_a = this.state.plot) === null || _a === void 0 ? void 0 : _a.destroy();
    };
    UPlotChart.prototype.componentDidUpdate = function (prevProps) {
        var _a;
        var plot = this.state.plot;
        if (!sameDims(prevProps, this.props)) {
            plot === null || plot === void 0 ? void 0 : plot.setSize({
                width: this.props.width,
                height: this.props.height,
            });
        }
        else if (!sameConfig(prevProps, this.props)) {
            this.reinitPlot();
        }
        else if (!sameData(prevProps, this.props)) {
            plot === null || plot === void 0 ? void 0 : plot.setData(this.props.data);
            // this is a uPlot cache-busting hack for bar charts in case x axis labels changed
            // since the x scale's "range" doesnt change, the axis size doesnt get recomputed, which is where the tick labels are regenerated & cached
            // the more expensive, more proper/thorough way to do this is to force all axes to recalc: plot?.redraw(false, true);
            if (plot && typeof ((_a = this.props.data[0]) === null || _a === void 0 ? void 0 : _a[0]) === 'string') {
                //@ts-ignore
                plot.axes[0]._values = this.props.data[0];
            }
        }
        else if (!sameTimeRange(prevProps, this.props)) {
            plot === null || plot === void 0 ? void 0 : plot.setScale('x', {
                min: this.props.timeRange.from.valueOf(),
                max: this.props.timeRange.to.valueOf(),
            });
        }
    };
    UPlotChart.prototype.render = function () {
        return (React.createElement("div", { style: { position: 'relative' } },
            React.createElement("div", { ref: this.plotContainer, "data-testid": "uplot-main-div" }),
            this.props.children));
    };
    return UPlotChart;
}(React.Component));
export { UPlotChart };
//# sourceMappingURL=Plot.js.map