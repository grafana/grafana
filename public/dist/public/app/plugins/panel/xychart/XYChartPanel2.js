import { __extends, __values } from "tslib";
import React, { PureComponent } from 'react';
import { LegendDisplayMode, Portal, UPlotChart, VizLayout, VizLegend, VizTooltipContainer, } from '@grafana/ui';
import { prepData, prepScatter } from './scatter';
import { config } from '@grafana/runtime';
import { TooltipView } from './TooltipView';
var XYChartPanel2 = /** @class */ (function (_super) {
    __extends(XYChartPanel2, _super);
    function XYChartPanel2() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            series: [],
        };
        _this.scatterHoverCallback = function (hover) {
            _this.setState({ hover: hover });
        };
        _this.getData = function () {
            return _this.props.data.series;
        };
        _this.initSeries = function () {
            var _a = _this.props, options = _a.options, data = _a.data;
            var info = prepScatter(options, _this.getData, config.theme2, _this.scatterHoverCallback);
            if (info.series.length && data.series) {
                info.facets = prepData(info, data.series);
                info.error = undefined;
            }
            _this.setState(info);
        };
        _this.initFacets = function () {
            _this.setState({
                facets: prepData(_this.state, _this.props.data.series),
            });
        };
        _this.renderLegend = function () {
            var e_1, _a, e_2, _b;
            var data = _this.props.data;
            var series = _this.state.series;
            var items = [];
            try {
                for (var series_1 = __values(series), series_1_1 = series_1.next(); !series_1_1.done; series_1_1 = series_1.next()) {
                    var s = series_1_1.value;
                    var frame = s.frame(data.series);
                    if (frame) {
                        try {
                            for (var _c = (e_2 = void 0, __values(s.legend(frame))), _d = _c.next(); !_d.done; _d = _c.next()) {
                                var item = _d.value;
                                items.push(item);
                            }
                        }
                        catch (e_2_1) { e_2 = { error: e_2_1 }; }
                        finally {
                            try {
                                if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                            }
                            finally { if (e_2) throw e_2.error; }
                        }
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (series_1_1 && !series_1_1.done && (_a = series_1.return)) _a.call(series_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return (React.createElement(VizLayout.Legend, { placement: "bottom" },
                React.createElement(VizLegend, { placement: "bottom", items: items, displayMode: LegendDisplayMode.List })));
        };
        return _this;
    }
    XYChartPanel2.prototype.componentDidMount = function () {
        this.initSeries(); // also data
    };
    XYChartPanel2.prototype.componentDidUpdate = function (oldProps) {
        var _a = this.props, options = _a.options, data = _a.data;
        var configsChanged = options !== oldProps.options || data.structureRev !== oldProps.data.structureRev;
        if (configsChanged) {
            this.initSeries();
        }
        else if (data !== oldProps.data) {
            this.initFacets();
        }
    };
    XYChartPanel2.prototype.render = function () {
        var _a = this.props, width = _a.width, height = _a.height, timeRange = _a.timeRange, data = _a.data;
        var _b = this.state, error = _b.error, facets = _b.facets, builder = _b.builder, hover = _b.hover, series = _b.series;
        if (error || !builder) {
            return (React.createElement("div", { className: "panel-empty" },
                React.createElement("p", null, error)));
        }
        return (React.createElement(React.Fragment, null,
            React.createElement(VizLayout, { width: width, height: height, legend: this.renderLegend() }, function (vizWidth, vizHeight) { return (
            // <pre style={{ width: vizWidth, height: vizHeight, border: '1px solid green', margin: '0px' }}>
            //   {JSON.stringify(scatterData, null, 2)}
            // </pre>
            React.createElement(UPlotChart, { config: builder, data: facets, width: vizWidth, height: vizHeight, timeRange: timeRange })); }),
            React.createElement(Portal, null, hover && (React.createElement(VizTooltipContainer, { position: { x: hover.pageX, y: hover.pageY }, offset: { x: 10, y: 10 } },
                React.createElement(TooltipView, { series: series[hover.scatterIndex], rowIndex: hover.xIndex, data: data.series }))))));
    };
    return XYChartPanel2;
}(PureComponent));
export { XYChartPanel2 };
//# sourceMappingURL=XYChartPanel2.js.map