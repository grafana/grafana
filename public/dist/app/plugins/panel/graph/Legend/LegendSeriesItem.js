import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import classNames from 'classnames';
import { SeriesColorPicker } from '@grafana/ui';
export var LEGEND_STATS = ['min', 'max', 'avg', 'current', 'total'];
var LegendItem = /** @class */ (function (_super) {
    tslib_1.__extends(LegendItem, _super);
    function LegendItem(props) {
        var _this = _super.call(this, props) || this;
        _this.onLabelClick = function (e) { return _this.props.onLabelClick(_this.props.series, e); };
        _this.onToggleAxis = function () {
            var yaxis = _this.state.yaxis === 2 ? 1 : 2;
            var info = { alias: _this.props.series.alias, yaxis: yaxis };
            _this.setState({ yaxis: yaxis });
            _this.props.onToggleAxis(info);
        };
        _this.onColorChange = function (color) {
            _this.props.onColorChange(_this.props.series, color);
            // Because of PureComponent nature it makes only shallow props comparison and changing of series.color doesn't run
            // component re-render. In this case we can't rely on color, selected by user, because it may be overwritten
            // by series overrides. So we need to use forceUpdate() to make sure we have proper series color.
            _this.forceUpdate();
        };
        _this.state = {
            yaxis: _this.props.series.yaxis,
        };
        return _this;
    }
    LegendItem.prototype.renderLegendValues = function () {
        var e_1, _a;
        var _b = this.props, series = _b.series, asTable = _b.asTable;
        var legendValueItems = [];
        try {
            for (var LEGEND_STATS_1 = tslib_1.__values(LEGEND_STATS), LEGEND_STATS_1_1 = LEGEND_STATS_1.next(); !LEGEND_STATS_1_1.done; LEGEND_STATS_1_1 = LEGEND_STATS_1.next()) {
                var valueName = LEGEND_STATS_1_1.value;
                if (this.props[valueName]) {
                    var valueFormatted = series.formatValue(series.stats[valueName]);
                    legendValueItems.push(React.createElement(LegendValue, { key: valueName, valueName: valueName, value: valueFormatted, asTable: asTable }));
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (LEGEND_STATS_1_1 && !LEGEND_STATS_1_1.done && (_a = LEGEND_STATS_1.return)) _a.call(LEGEND_STATS_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return legendValueItems;
    };
    LegendItem.prototype.render = function () {
        var _a = this.props, series = _a.series, values = _a.values, asTable = _a.asTable, hidden = _a.hidden;
        var seriesOptionClasses = classNames({
            'graph-legend-series-hidden': hidden,
            'graph-legend-series--right-y': series.yaxis === 2,
        });
        var valueItems = values ? this.renderLegendValues() : [];
        var seriesLabel = (React.createElement(LegendSeriesLabel, { label: series.alias, color: series.color, yaxis: this.state.yaxis, onLabelClick: this.onLabelClick, onColorChange: this.onColorChange, onToggleAxis: this.onToggleAxis }));
        if (asTable) {
            return (React.createElement("tr", { className: "graph-legend-series " + seriesOptionClasses },
                React.createElement("td", null, seriesLabel),
                valueItems));
        }
        else {
            return (React.createElement("div", { className: "graph-legend-series " + seriesOptionClasses },
                seriesLabel,
                valueItems));
        }
    };
    LegendItem.defaultProps = {
        asTable: false,
        hidden: false,
        onLabelClick: function () { },
        onColorChange: function () { },
        onToggleAxis: function () { },
    };
    return LegendItem;
}(PureComponent));
export { LegendItem };
var LegendSeriesLabel = /** @class */ (function (_super) {
    tslib_1.__extends(LegendSeriesLabel, _super);
    function LegendSeriesLabel() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    LegendSeriesLabel.prototype.render = function () {
        var _this = this;
        var _a = this.props, label = _a.label, color = _a.color, yaxis = _a.yaxis;
        var _b = this.props, onColorChange = _b.onColorChange, onToggleAxis = _b.onToggleAxis;
        return [
            React.createElement(LegendSeriesIcon, { key: "icon", color: color, yaxis: yaxis, onColorChange: onColorChange, onToggleAxis: onToggleAxis }),
            React.createElement("a", { className: "graph-legend-alias pointer", title: label, key: "label", onClick: function (e) { return _this.props.onLabelClick(e); } }, label),
        ];
    };
    LegendSeriesLabel.defaultProps = {
        yaxis: undefined,
        onLabelClick: function () { },
    };
    return LegendSeriesLabel;
}(PureComponent));
function SeriesIcon(_a) {
    var color = _a.color;
    return React.createElement("i", { className: "fa fa-minus pointer", style: { color: color } });
}
var LegendSeriesIcon = /** @class */ (function (_super) {
    tslib_1.__extends(LegendSeriesIcon, _super);
    function LegendSeriesIcon() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    LegendSeriesIcon.prototype.render = function () {
        var _this = this;
        return (React.createElement(SeriesColorPicker, { yaxis: this.props.yaxis, color: this.props.color, onChange: this.props.onColorChange, onToggleAxis: this.props.onToggleAxis, enableNamedColors: true }, function (_a) {
            var ref = _a.ref, showColorPicker = _a.showColorPicker, hideColorPicker = _a.hideColorPicker;
            return (React.createElement("span", { ref: ref, onClick: showColorPicker, onMouseLeave: hideColorPicker, className: "graph-legend-icon" },
                React.createElement(SeriesIcon, { color: _this.props.color })));
        }));
    };
    LegendSeriesIcon.defaultProps = {
        yaxis: undefined,
        onColorChange: function () { },
        onToggleAxis: function () { },
    };
    return LegendSeriesIcon;
}(PureComponent));
function LegendValue(props) {
    var value = props.value;
    var valueName = props.valueName;
    if (props.asTable) {
        return React.createElement("td", { className: "graph-legend-value " + valueName }, value);
    }
    return React.createElement("div", { className: "graph-legend-value " + valueName }, value);
}
//# sourceMappingURL=LegendSeriesItem.js.map