import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import { calculateLogsLabelStats } from 'app/core/logs_model';
import { LogLabelStats } from './LogLabelStats';
var LogLabel = /** @class */ (function (_super) {
    tslib_1.__extends(LogLabel, _super);
    function LogLabel() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            stats: null,
            showStats: false,
        };
        _this.onClickClose = function () {
            _this.setState({ showStats: false });
        };
        _this.onClickLabel = function () {
            var _a = _this.props, onClickLabel = _a.onClickLabel, label = _a.label, value = _a.value;
            if (onClickLabel) {
                onClickLabel(label, value);
            }
        };
        _this.onClickStats = function () {
            _this.setState(function (state) {
                if (state.showStats) {
                    return { showStats: false, stats: null };
                }
                var allRows = _this.props.getRows();
                var stats = calculateLogsLabelStats(allRows, _this.props.label);
                return { showStats: true, stats: stats };
            });
        };
        return _this;
    }
    LogLabel.prototype.render = function () {
        var _a = this.props, getRows = _a.getRows, label = _a.label, plain = _a.plain, value = _a.value;
        var _b = this.state, showStats = _b.showStats, stats = _b.stats;
        var tooltip = label + ": " + value;
        return (React.createElement("span", { className: "logs-label" },
            React.createElement("span", { className: "logs-label__value", title: tooltip }, value),
            !plain && (React.createElement("span", { title: "Filter for label", onClick: this.onClickLabel, className: "logs-label__icon fa fa-search-plus" })),
            !plain && getRows && React.createElement("span", { onClick: this.onClickStats, className: "logs-label__icon fa fa-signal" }),
            showStats && (React.createElement("span", { className: "logs-label__stats" },
                React.createElement(LogLabelStats, { stats: stats, rowCount: getRows().length, label: label, value: value, onClickClose: this.onClickClose })))));
    };
    return LogLabel;
}(PureComponent));
export { LogLabel };
//# sourceMappingURL=LogLabel.js.map