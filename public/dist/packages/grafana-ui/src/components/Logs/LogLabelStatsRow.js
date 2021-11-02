import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { useStyles } from '../../themes/ThemeContext';
var getStyles = function (theme) { return ({
    logsStatsRow: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    label: logs-stats-row;\n    margin: ", "px 0;\n  "], ["\n    label: logs-stats-row;\n    margin: ", "px 0;\n  "])), parseInt(theme.spacing.d, 10) / 1.75),
    logsStatsRowActive: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    label: logs-stats-row--active;\n    color: ", ";\n    position: relative;\n  "], ["\n    label: logs-stats-row--active;\n    color: ", ";\n    position: relative;\n  "])), theme.colors.textBlue),
    logsStatsRowLabel: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    label: logs-stats-row__label;\n    display: flex;\n    margin-bottom: 1px;\n  "], ["\n    label: logs-stats-row__label;\n    display: flex;\n    margin-bottom: 1px;\n  "]))),
    logsStatsRowValue: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    label: logs-stats-row__value;\n    flex: 1;\n    text-overflow: ellipsis;\n    overflow: hidden;\n  "], ["\n    label: logs-stats-row__value;\n    flex: 1;\n    text-overflow: ellipsis;\n    overflow: hidden;\n  "]))),
    logsStatsRowCount: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    label: logs-stats-row__count;\n    text-align: right;\n    margin-left: 0.5em;\n  "], ["\n    label: logs-stats-row__count;\n    text-align: right;\n    margin-left: 0.5em;\n  "]))),
    logsStatsRowPercent: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n    label: logs-stats-row__percent;\n    text-align: right;\n    margin-left: 0.5em;\n    width: 3em;\n  "], ["\n    label: logs-stats-row__percent;\n    text-align: right;\n    margin-left: 0.5em;\n    width: 3em;\n  "]))),
    logsStatsRowBar: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n    label: logs-stats-row__bar;\n    height: 4px;\n    overflow: hidden;\n    background: ", ";\n  "], ["\n    label: logs-stats-row__bar;\n    height: 4px;\n    overflow: hidden;\n    background: ", ";\n  "])), theme.colors.textFaint),
    logsStatsRowInnerBar: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n    label: logs-stats-row__innerbar;\n    height: 4px;\n    overflow: hidden;\n    background: ", ";\n  "], ["\n    label: logs-stats-row__innerbar;\n    height: 4px;\n    overflow: hidden;\n    background: ", ";\n  "])), theme.colors.bgBlue1),
}); };
export var LogLabelStatsRow = function (_a) {
    var active = _a.active, count = _a.count, proportion = _a.proportion, value = _a.value;
    var style = useStyles(getStyles);
    var percent = Math.round(proportion * 100) + "%";
    var barStyle = { width: percent };
    var className = active ? cx([style.logsStatsRow, style.logsStatsRowActive]) : cx([style.logsStatsRow]);
    return (React.createElement("div", { className: className },
        React.createElement("div", { className: cx([style.logsStatsRowLabel]) },
            React.createElement("div", { className: cx([style.logsStatsRowValue]), title: value }, value),
            React.createElement("div", { className: cx([style.logsStatsRowCount]) }, count),
            React.createElement("div", { className: cx([style.logsStatsRowPercent]) }, percent)),
        React.createElement("div", { className: cx([style.logsStatsRowBar]) },
            React.createElement("div", { className: cx([style.logsStatsRowInnerBar]), style: barStyle }))));
};
LogLabelStatsRow.displayName = 'LogLabelStatsRow';
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8;
//# sourceMappingURL=LogLabelStatsRow.js.map