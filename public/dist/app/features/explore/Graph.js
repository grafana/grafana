import * as tslib_1 from "tslib";
import $ from 'jquery';
import React, { PureComponent } from 'react';
import moment from 'moment';
import 'vendor/flot/jquery.flot';
import 'vendor/flot/jquery.flot.time';
import 'vendor/flot/jquery.flot.selection';
import 'vendor/flot/jquery.flot.stack';
import * as dateMath from 'app/core/utils/datemath';
import Legend from './Legend';
import { equal, intersect } from './utils/set';
var MAX_NUMBER_OF_TIME_SERIES = 20;
// Copied from graph.ts
function time_format(ticks, min, max) {
    if (min && max && ticks) {
        var range = max - min;
        var secPerTick = range / ticks / 1000;
        var oneDay = 86400000;
        var oneYear = 31536000000;
        if (secPerTick <= 45) {
            return '%H:%M:%S';
        }
        if (secPerTick <= 7200 || range <= oneDay) {
            return '%H:%M';
        }
        if (secPerTick <= 80000) {
            return '%m/%d %H:%M';
        }
        if (secPerTick <= 2419200 || range <= oneYear) {
            return '%m/%d';
        }
        return '%Y-%m';
    }
    return '%H:%M';
}
var FLOT_OPTIONS = {
    legend: {
        show: false,
    },
    series: {
        lines: {
            linewidth: 1,
            zero: false,
        },
        shadowSize: 0,
    },
    grid: {
        minBorderMargin: 0,
        markings: [],
        backgroundColor: null,
        borderWidth: 0,
        // hoverable: true,
        clickable: true,
        color: '#a1a1a1',
        margin: { left: 0, right: 0 },
        labelMarginX: 0,
    },
    selection: {
        mode: 'x',
        color: '#666',
    },
};
var Graph = /** @class */ (function (_super) {
    tslib_1.__extends(Graph, _super);
    function Graph() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.dynamicOptions = null;
        _this.state = {
            hiddenSeries: new Set(),
            showAllTimeSeries: false,
        };
        _this.onPlotSelected = function (event, ranges) {
            if (_this.props.onChangeTime) {
                var range = {
                    from: moment(ranges.xaxis.from),
                    to: moment(ranges.xaxis.to),
                };
                _this.props.onChangeTime(range);
            }
        };
        _this.onShowAllTimeSeries = function () {
            _this.setState({
                showAllTimeSeries: true,
            }, _this.draw);
        };
        _this.onToggleSeries = function (series, exclusive) {
            _this.setState(function (state, props) {
                var data = props.data, onToggleSeries = props.onToggleSeries;
                var hiddenSeries = state.hiddenSeries;
                // Deduplicate series as visibility tracks the alias property
                var oneSeriesVisible = hiddenSeries.size === new Set(data.map(function (d) { return d.alias; })).size - 1;
                var nextHiddenSeries = new Set();
                if (exclusive) {
                    if (hiddenSeries.has(series.alias) || !oneSeriesVisible) {
                        nextHiddenSeries = new Set(data.filter(function (d) { return d.alias !== series.alias; }).map(function (d) { return d.alias; }));
                    }
                }
                else {
                    // Prune hidden series no longer part of those available from the most recent query
                    var availableSeries = new Set(data.map(function (d) { return d.alias; }));
                    nextHiddenSeries = intersect(new Set(hiddenSeries), availableSeries);
                    if (nextHiddenSeries.has(series.alias)) {
                        nextHiddenSeries.delete(series.alias);
                    }
                    else {
                        nextHiddenSeries.add(series.alias);
                    }
                }
                if (onToggleSeries) {
                    onToggleSeries(series.alias, nextHiddenSeries);
                }
                return {
                    hiddenSeries: nextHiddenSeries,
                };
            }, _this.draw);
        };
        return _this;
    }
    Graph.prototype.getGraphData = function () {
        var data = this.props.data;
        return this.state.showAllTimeSeries ? data : data.slice(0, MAX_NUMBER_OF_TIME_SERIES);
    };
    Graph.prototype.componentDidMount = function () {
        this.draw();
        this.$el = $("#" + this.props.id);
        this.$el.bind('plotselected', this.onPlotSelected);
    };
    Graph.prototype.componentDidUpdate = function (prevProps, prevState) {
        if (prevProps.data !== this.props.data ||
            prevProps.range !== this.props.range ||
            prevProps.split !== this.props.split ||
            prevProps.height !== this.props.height ||
            prevProps.width !== this.props.width ||
            !equal(prevState.hiddenSeries, this.state.hiddenSeries)) {
            this.draw();
        }
    };
    Graph.prototype.componentWillUnmount = function () {
        this.$el.unbind('plotselected', this.onPlotSelected);
    };
    Graph.prototype.getDynamicOptions = function () {
        var _a = this.props, range = _a.range, width = _a.width;
        var ticks = (width || 0) / 100;
        var from = range.from, to = range.to;
        if (!moment.isMoment(from)) {
            from = dateMath.parse(from, false);
        }
        if (!moment.isMoment(to)) {
            to = dateMath.parse(to, true);
        }
        var min = from.valueOf();
        var max = to.valueOf();
        return {
            xaxis: {
                mode: 'time',
                min: min,
                max: max,
                label: 'Datetime',
                ticks: ticks,
                timezone: 'browser',
                timeformat: time_format(ticks, min, max),
            },
        };
    };
    Graph.prototype.draw = function () {
        var _a = this.props.userOptions, userOptions = _a === void 0 ? {} : _a;
        var hiddenSeries = this.state.hiddenSeries;
        var data = this.getGraphData();
        var $el = $("#" + this.props.id);
        var series = [{ data: [[0, 0]] }];
        if (data && data.length > 0) {
            series = data
                .filter(function (ts) { return !hiddenSeries.has(ts.alias); })
                .map(function (ts) { return ({
                color: ts.color,
                label: ts.label,
                data: ts.getFlotPairs('null'),
            }); });
        }
        this.dynamicOptions = this.getDynamicOptions();
        var options = tslib_1.__assign({}, FLOT_OPTIONS, this.dynamicOptions, userOptions);
        $.plot($el, series, options);
    };
    Graph.prototype.render = function () {
        var _a = this.props, _b = _a.height, height = _b === void 0 ? 100 : _b, _c = _a.id, id = _c === void 0 ? 'graph' : _c;
        var hiddenSeries = this.state.hiddenSeries;
        var data = this.getGraphData();
        return (React.createElement(React.Fragment, null,
            this.props.data && this.props.data.length > MAX_NUMBER_OF_TIME_SERIES && !this.state.showAllTimeSeries && (React.createElement("div", { className: "time-series-disclaimer" },
                React.createElement("i", { className: "fa fa-fw fa-warning disclaimer-icon" }), "Showing only " + MAX_NUMBER_OF_TIME_SERIES + " time series. ",
                React.createElement("span", { className: "show-all-time-series", onClick: this.onShowAllTimeSeries }, "Show all " + this.props.data.length))),
            React.createElement("div", { id: id, className: "explore-graph", style: { height: height } }),
            React.createElement(Legend, { data: data, hiddenSeries: hiddenSeries, onToggleSeries: this.onToggleSeries })));
    };
    return Graph;
}(PureComponent));
export { Graph };
export default Graph;
//# sourceMappingURL=Graph.js.map