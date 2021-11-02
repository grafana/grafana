import { __assign, __extends, __read, __spreadArray } from "tslib";
import { sortBy as _sortBy } from 'lodash';
import React, { PureComponent } from 'react';
import { CustomScrollbar, Icon } from '@grafana/ui';
import { LegendItem, LEGEND_STATS } from './LegendSeriesItem';
var GraphLegend = /** @class */ (function (_super) {
    __extends(GraphLegend, _super);
    function GraphLegend(props) {
        var _this = _super.call(this, props) || this;
        _this.onToggleSeries = function (series, event) {
            if (!_this.props.onToggleSeries) {
                return;
            }
            var hiddenSeries = __assign({}, _this.state.hiddenSeries);
            if (event.ctrlKey || event.metaKey || event.shiftKey) {
                if (hiddenSeries[series.alias]) {
                    delete hiddenSeries[series.alias];
                }
                else {
                    hiddenSeries[series.alias] = true;
                }
            }
            else {
                hiddenSeries = _this.toggleSeriesExclusiveMode(series);
            }
            _this.setState({ hiddenSeries: hiddenSeries });
            _this.props.onToggleSeries(hiddenSeries);
        };
        _this.state = {
            hiddenSeries: _this.props.hiddenSeries,
        };
        return _this;
    }
    GraphLegend.prototype.sortLegend = function () {
        var seriesList = __spreadArray([], __read(this.props.seriesList), false) || [];
        var sortBy = this.props.sort;
        if (sortBy && this.props[sortBy] && this.props.alignAsTable) {
            seriesList = _sortBy(seriesList, function (series) {
                var sort = series.stats[sortBy];
                if (sort === null) {
                    sort = -Infinity;
                }
                return sort;
            });
            if (this.props.sortDesc) {
                seriesList = seriesList.reverse();
            }
        }
        return seriesList;
    };
    GraphLegend.prototype.toggleSeriesExclusiveMode = function (series) {
        var hiddenSeries = __assign({}, this.state.hiddenSeries);
        if (hiddenSeries[series.alias]) {
            delete hiddenSeries[series.alias];
        }
        // check if every other series is hidden
        var alreadyExclusive = this.props.seriesList.every(function (value) {
            if (value.alias === series.alias) {
                return true;
            }
            return hiddenSeries[value.alias];
        });
        if (alreadyExclusive) {
            // remove all hidden series
            this.props.seriesList.forEach(function (value) {
                delete hiddenSeries[value.alias];
            });
        }
        else {
            // hide all but this serie
            this.props.seriesList.forEach(function (value) {
                if (value.alias === series.alias) {
                    return;
                }
                hiddenSeries[value.alias] = true;
            });
        }
        return hiddenSeries;
    };
    GraphLegend.prototype.render = function () {
        var _a = this.props, optionalClass = _a.optionalClass, rightSide = _a.rightSide, sideWidth = _a.sideWidth, sort = _a.sort, sortDesc = _a.sortDesc, hideEmpty = _a.hideEmpty, hideZero = _a.hideZero, values = _a.values, min = _a.min, max = _a.max, avg = _a.avg, current = _a.current, total = _a.total;
        var seriesValuesProps = { values: values, min: min, max: max, avg: avg, current: current, total: total };
        var hiddenSeries = this.state.hiddenSeries;
        var seriesHideProps = { hideEmpty: hideEmpty, hideZero: hideZero };
        var sortProps = { sort: sort, sortDesc: sortDesc };
        var seriesList = this.sortLegend().filter(function (series) { return !series.hideFromLegend(seriesHideProps); });
        var legendClass = (this.props.alignAsTable ? 'graph-legend-table' : '') + " " + optionalClass;
        // Set min-width if side style and there is a value, otherwise remove the CSS property
        // Set width so it works with IE11
        var width = rightSide && sideWidth ? sideWidth : undefined;
        var ieWidth = rightSide && sideWidth ? sideWidth - 1 : undefined;
        var legendStyle = {
            minWidth: width,
            width: ieWidth,
        };
        var legendProps = __assign(__assign({ seriesList: seriesList, hiddenSeries: hiddenSeries, onToggleSeries: this.onToggleSeries, onToggleAxis: this.props.onToggleAxis, onToggleSort: this.props.onToggleSort, onColorChange: this.props.onColorChange }, seriesValuesProps), sortProps);
        return (React.createElement("div", { className: "graph-legend-content " + legendClass, style: legendStyle }, this.props.alignAsTable ? React.createElement(LegendTable, __assign({}, legendProps)) : React.createElement(LegendSeriesList, __assign({}, legendProps))));
    };
    GraphLegend.defaultProps = {
        values: false,
        min: false,
        max: false,
        avg: false,
        current: false,
        total: false,
        alignAsTable: false,
        rightSide: false,
        sort: undefined,
        sortDesc: false,
        optionalClass: '',
        onToggleSeries: function () { },
        onToggleSort: function () { },
        onToggleAxis: function () { },
        onColorChange: function () { },
    };
    return GraphLegend;
}(PureComponent));
export { GraphLegend };
var LegendSeriesList = /** @class */ (function (_super) {
    __extends(LegendSeriesList, _super);
    function LegendSeriesList() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    LegendSeriesList.prototype.render = function () {
        var _this = this;
        var _a = this.props, seriesList = _a.seriesList, hiddenSeries = _a.hiddenSeries, values = _a.values, min = _a.min, max = _a.max, avg = _a.avg, current = _a.current, total = _a.total;
        var seriesValuesProps = { values: values, min: min, max: max, avg: avg, current: current, total: total };
        return seriesList.map(function (series, i) { return (React.createElement(LegendItem
        // This trick required because TimeSeries.id is not unique (it's just TimeSeries.alias).
        // In future would be good to make id unique across the series list.
        , __assign({ 
            // This trick required because TimeSeries.id is not unique (it's just TimeSeries.alias).
            // In future would be good to make id unique across the series list.
            key: series.id + "-" + i, series: series, hidden: hiddenSeries[series.alias] }, seriesValuesProps, { onLabelClick: _this.props.onToggleSeries, onColorChange: _this.props.onColorChange, onToggleAxis: _this.props.onToggleAxis }))); });
    };
    return LegendSeriesList;
}(PureComponent));
var LegendTable = /** @class */ (function (_super) {
    __extends(LegendTable, _super);
    function LegendTable() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onToggleSort = function (stat) {
            if (!_this.props.onToggleSort) {
                return;
            }
            var sortDesc = _this.props.sortDesc;
            var sortBy = _this.props.sort;
            if (stat !== sortBy) {
                sortDesc = undefined;
            }
            // if already sort ascending, disable sorting
            if (sortDesc === false) {
                sortBy = undefined;
                sortDesc = undefined;
            }
            else {
                sortDesc = !sortDesc;
                sortBy = stat;
            }
            _this.props.onToggleSort(sortBy, sortDesc);
        };
        return _this;
    }
    LegendTable.prototype.render = function () {
        var _this = this;
        var seriesList = this.props.seriesList;
        var _a = this.props, values = _a.values, min = _a.min, max = _a.max, avg = _a.avg, current = _a.current, total = _a.total, sort = _a.sort, sortDesc = _a.sortDesc, hiddenSeries = _a.hiddenSeries;
        var seriesValuesProps = { values: values, min: min, max: max, avg: avg, current: current, total: total };
        if (!seriesList) {
            return null;
        }
        return (React.createElement("table", null,
            React.createElement("colgroup", null,
                React.createElement("col", { style: { width: '100%' } })),
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", { style: { textAlign: 'left' } }),
                    LEGEND_STATS.map(function (statName) {
                        return seriesValuesProps[statName] && (React.createElement(LegendTableHeaderItem, { key: statName, statName: statName, sort: sort, sortDesc: sortDesc, onClick: _this.onToggleSort }));
                    }))),
            React.createElement("tbody", null, seriesList &&
                seriesList.map(function (series, i) { return (React.createElement(LegendItem, __assign({ key: series.id + "-" + i, asTable: true, series: series, hidden: hiddenSeries[series.alias], onLabelClick: _this.props.onToggleSeries, onColorChange: _this.props.onColorChange, onToggleAxis: _this.props.onToggleAxis }, seriesValuesProps))); }))));
    };
    return LegendTable;
}(PureComponent));
var LegendTableHeaderItem = /** @class */ (function (_super) {
    __extends(LegendTableHeaderItem, _super);
    function LegendTableHeaderItem() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onClick = function () {
            if (_this.props.onClick) {
                _this.props.onClick(_this.props.statName);
            }
        };
        return _this;
    }
    LegendTableHeaderItem.prototype.render = function () {
        var _a = this.props, statName = _a.statName, sort = _a.sort, sortDesc = _a.sortDesc;
        return (React.createElement("th", { className: "pointer", onClick: this.onClick },
            statName,
            sort === statName && React.createElement(Icon, { name: sortDesc ? 'angle-down' : 'angle-up' })));
    };
    return LegendTableHeaderItem;
}(PureComponent));
var Legend = /** @class */ (function (_super) {
    __extends(Legend, _super);
    function Legend() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Legend.prototype.render = function () {
        return (React.createElement(CustomScrollbar, { hideHorizontalTrack: true },
            React.createElement(GraphLegend, __assign({}, this.props))));
    };
    return Legend;
}(PureComponent));
export { Legend };
export default Legend;
//# sourceMappingURL=Legend.js.map