import { __assign, __extends } from "tslib";
import React from 'react';
import { difference, isEqual } from 'lodash';
var GraphSeriesToggler = /** @class */ (function (_super) {
    __extends(GraphSeriesToggler, _super);
    function GraphSeriesToggler(props) {
        var _this = _super.call(this, props) || this;
        _this.onSeriesToggle = _this.onSeriesToggle.bind(_this);
        _this.state = {
            hiddenSeries: [],
            toggledSeries: props.series,
        };
        return _this;
    }
    GraphSeriesToggler.prototype.componentDidUpdate = function (prevProps) {
        var series = this.props.series;
        if (!isEqual(prevProps.series, series)) {
            this.setState({ hiddenSeries: [], toggledSeries: series });
        }
    };
    GraphSeriesToggler.prototype.onSeriesToggle = function (label, event) {
        var _a = this.props, series = _a.series, onHiddenSeriesChanged = _a.onHiddenSeriesChanged;
        var hiddenSeries = this.state.hiddenSeries;
        if (event.ctrlKey || event.metaKey || event.shiftKey) {
            // Toggling series with key makes the series itself to toggle
            var newHiddenSeries_1 = hiddenSeries.indexOf(label) > -1
                ? hiddenSeries.filter(function (series) { return series !== label; })
                : hiddenSeries.concat([label]);
            var toggledSeries_1 = series.map(function (series) { return (__assign(__assign({}, series), { isVisible: newHiddenSeries_1.indexOf(series.label) === -1 })); });
            this.setState({ hiddenSeries: newHiddenSeries_1, toggledSeries: toggledSeries_1 }, function () {
                return onHiddenSeriesChanged ? onHiddenSeriesChanged(newHiddenSeries_1) : undefined;
            });
            return;
        }
        // Toggling series with out key toggles all the series but the clicked one
        var allSeriesLabels = series.map(function (series) { return series.label; });
        var newHiddenSeries = hiddenSeries.length + 1 === allSeriesLabels.length ? [] : difference(allSeriesLabels, [label]);
        var toggledSeries = series.map(function (series) { return (__assign(__assign({}, series), { isVisible: newHiddenSeries.indexOf(series.label) === -1 })); });
        this.setState({ hiddenSeries: newHiddenSeries, toggledSeries: toggledSeries }, function () {
            return onHiddenSeriesChanged ? onHiddenSeriesChanged(newHiddenSeries) : undefined;
        });
    };
    GraphSeriesToggler.prototype.render = function () {
        var children = this.props.children;
        var toggledSeries = this.state.toggledSeries;
        return children({
            onSeriesToggle: this.onSeriesToggle,
            toggledSeries: toggledSeries,
        });
    };
    return GraphSeriesToggler;
}(React.Component));
export { GraphSeriesToggler };
//# sourceMappingURL=GraphSeriesToggler.js.map