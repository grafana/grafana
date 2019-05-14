import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import classNames from 'classnames';
var LegendItem = /** @class */ (function (_super) {
    tslib_1.__extends(LegendItem, _super);
    function LegendItem() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onClickLabel = function (e) { return _this.props.onClickLabel(_this.props.series, e); };
        return _this;
    }
    LegendItem.prototype.render = function () {
        var _a = this.props, hidden = _a.hidden, series = _a.series;
        var seriesClasses = classNames({
            'graph-legend-series-hidden': hidden,
        });
        return (React.createElement("div", { className: "graph-legend-series " + seriesClasses },
            React.createElement("div", { className: "graph-legend-icon" },
                React.createElement("i", { className: "fa fa-minus pointer", style: { color: series.color } })),
            React.createElement("a", { className: "graph-legend-alias pointer", title: series.alias, onClick: this.onClickLabel }, series.alias)));
    };
    return LegendItem;
}(PureComponent));
var Legend = /** @class */ (function (_super) {
    tslib_1.__extends(Legend, _super);
    function Legend() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onClickLabel = function (series, event) {
            var onToggleSeries = _this.props.onToggleSeries;
            var exclusive = event.ctrlKey || event.metaKey || event.shiftKey;
            onToggleSeries(series, !exclusive);
        };
        return _this;
    }
    Legend.prototype.render = function () {
        var _this = this;
        var _a = this.props, data = _a.data, hiddenSeries = _a.hiddenSeries;
        var items = data || [];
        return (React.createElement("div", { className: "graph-legend ps" }, items.map(function (series, i) { return (React.createElement(LegendItem, { hidden: hiddenSeries.has(series.alias), 
            // Workaround to resolve conflicts since series visibility tracks the alias property
            key: series.id + "-" + i, onClickLabel: _this.onClickLabel, series: series })); })));
    };
    Legend.defaultProps = {
        onToggleSeries: function () { },
    };
    return Legend;
}(PureComponent));
export default Legend;
//# sourceMappingURL=Legend.js.map