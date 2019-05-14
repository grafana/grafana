import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import classnames from 'classnames';
function LogLabelStatsRow(logLabelStatsModel) {
    var active = logLabelStatsModel.active, count = logLabelStatsModel.count, proportion = logLabelStatsModel.proportion, value = logLabelStatsModel.value;
    var percent = Math.round(proportion * 100) + "%";
    var barStyle = { width: percent };
    var className = classnames('logs-stats-row', { 'logs-stats-row--active': active });
    return (React.createElement("div", { className: className },
        React.createElement("div", { className: "logs-stats-row__label" },
            React.createElement("div", { className: "logs-stats-row__value", title: value }, value),
            React.createElement("div", { className: "logs-stats-row__count" }, count),
            React.createElement("div", { className: "logs-stats-row__percent" }, percent)),
        React.createElement("div", { className: "logs-stats-row__bar" },
            React.createElement("div", { className: "logs-stats-row__innerbar", style: barStyle }))));
}
var STATS_ROW_LIMIT = 5;
var LogLabelStats = /** @class */ (function (_super) {
    tslib_1.__extends(LogLabelStats, _super);
    function LogLabelStats() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    LogLabelStats.prototype.render = function () {
        var _a = this.props, label = _a.label, rowCount = _a.rowCount, stats = _a.stats, value = _a.value, onClickClose = _a.onClickClose;
        var topRows = stats.slice(0, STATS_ROW_LIMIT);
        var activeRow = topRows.find(function (row) { return row.value === value; });
        var otherRows = stats.slice(STATS_ROW_LIMIT);
        var insertActiveRow = !activeRow;
        // Remove active row from other to show extra
        if (insertActiveRow) {
            activeRow = otherRows.find(function (row) { return row.value === value; });
            otherRows = otherRows.filter(function (row) { return row.value !== value; });
        }
        var otherCount = otherRows.reduce(function (sum, row) { return sum + row.count; }, 0);
        var topCount = topRows.reduce(function (sum, row) { return sum + row.count; }, 0);
        var total = topCount + otherCount;
        var otherProportion = otherCount / total;
        return (React.createElement("div", { className: "logs-stats" },
            React.createElement("div", { className: "logs-stats__header" },
                React.createElement("span", { className: "logs-stats__title" },
                    label,
                    ": ",
                    total,
                    " of ",
                    rowCount,
                    " rows have that label"),
                React.createElement("span", { className: "logs-stats__close fa fa-remove", onClick: onClickClose })),
            React.createElement("div", { className: "logs-stats__body" },
                topRows.map(function (stat) { return (React.createElement(LogLabelStatsRow, tslib_1.__assign({ key: stat.value }, stat, { active: stat.value === value }))); }),
                insertActiveRow && activeRow && React.createElement(LogLabelStatsRow, tslib_1.__assign({ key: activeRow.value }, activeRow, { active: true })),
                otherCount > 0 && (React.createElement(LogLabelStatsRow, { key: "__OTHERS__", count: otherCount, value: "Other", proportion: otherProportion })))));
    };
    return LogLabelStats;
}(PureComponent));
export { LogLabelStats };
//# sourceMappingURL=LogLabelStats.js.map