import { __assign, __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { css } from '@emotion/css';
import { stylesFactory } from '../../themes';
import { withTheme } from '../../themes/index';
//Components
import { LogLabelStatsRow } from './LogLabelStatsRow';
var STATS_ROW_LIMIT = 5;
var getStyles = stylesFactory(function (theme) {
    return {
        logsStats: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: logs-stats;\n      column-span: 2;\n      background: inherit;\n      color: ", ";\n      word-break: break-all;\n    "], ["\n      label: logs-stats;\n      column-span: 2;\n      background: inherit;\n      color: ", ";\n      word-break: break-all;\n    "])), theme.colors.text),
        logsStatsHeader: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      label: logs-stats__header;\n      border-bottom: 1px solid ", ";\n      display: flex;\n    "], ["\n      label: logs-stats__header;\n      border-bottom: 1px solid ", ";\n      display: flex;\n    "])), theme.colors.border2),
        logsStatsTitle: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      label: logs-stats__title;\n      font-weight: ", ";\n      padding-right: ", ";\n      display: inline-block;\n      white-space: nowrap;\n      text-overflow: ellipsis;\n      flex-grow: 1;\n    "], ["\n      label: logs-stats__title;\n      font-weight: ", ";\n      padding-right: ", ";\n      display: inline-block;\n      white-space: nowrap;\n      text-overflow: ellipsis;\n      flex-grow: 1;\n    "])), theme.typography.weight.semibold, theme.spacing.d),
        logsStatsClose: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      label: logs-stats__close;\n      cursor: pointer;\n    "], ["\n      label: logs-stats__close;\n      cursor: pointer;\n    "]))),
        logsStatsBody: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      label: logs-stats__body;\n      padding: 5px 0;\n    "], ["\n      label: logs-stats__body;\n      padding: 5px 0;\n    "]))),
    };
});
var UnThemedLogLabelStats = /** @class */ (function (_super) {
    __extends(UnThemedLogLabelStats, _super);
    function UnThemedLogLabelStats() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    UnThemedLogLabelStats.prototype.render = function () {
        var _a = this.props, label = _a.label, rowCount = _a.rowCount, stats = _a.stats, value = _a.value, theme = _a.theme, isLabel = _a.isLabel;
        var style = getStyles(theme);
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
        return (React.createElement("td", { className: style.logsStats, "data-testid": "logLabelStats" },
            React.createElement("div", { className: style.logsStatsHeader },
                React.createElement("div", { className: style.logsStatsTitle },
                    label,
                    ": ",
                    total,
                    " of ",
                    rowCount,
                    " rows have that ",
                    isLabel ? 'label' : 'field')),
            React.createElement("div", { className: style.logsStatsBody },
                topRows.map(function (stat) { return (React.createElement(LogLabelStatsRow, __assign({ key: stat.value }, stat, { active: stat.value === value }))); }),
                insertActiveRow && activeRow && React.createElement(LogLabelStatsRow, __assign({ key: activeRow.value }, activeRow, { active: true })),
                otherCount > 0 && (React.createElement(LogLabelStatsRow, { key: "__OTHERS__", count: otherCount, value: "Other", proportion: otherProportion })))));
    };
    return UnThemedLogLabelStats;
}(PureComponent));
export var LogLabelStats = withTheme(UnThemedLogLabelStats);
LogLabelStats.displayName = 'LogLabelStats';
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=LogLabelStats.js.map