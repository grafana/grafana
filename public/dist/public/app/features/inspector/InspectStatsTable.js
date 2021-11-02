import { __makeTemplateObject } from "tslib";
import React from 'react';
import { FieldType, formattedValueToString, getDisplayProcessor, } from '@grafana/data';
import { stylesFactory, useTheme2 } from '@grafana/ui';
import { css } from '@emotion/css';
export var InspectStatsTable = function (_a) {
    var timeZone = _a.timeZone, name = _a.name, stats = _a.stats;
    var theme = useTheme2();
    var styles = getStyles(theme);
    if (!stats || !stats.length) {
        return null;
    }
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement("div", { className: "section-heading" }, name),
        React.createElement("table", { className: "filter-table width-30" },
            React.createElement("tbody", null, stats.map(function (stat, index) {
                return (React.createElement("tr", { key: stat.displayName + "-" + index },
                    React.createElement("td", null, stat.displayName),
                    React.createElement("td", { className: styles.cell }, formatStat(stat, timeZone, theme))));
            })))));
};
function formatStat(stat, timeZone, theme) {
    var display = getDisplayProcessor({
        field: {
            type: FieldType.number,
            config: stat,
        },
        theme: theme,
        timeZone: timeZone,
    });
    return formattedValueToString(display(stat.value));
}
var getStyles = stylesFactory(function (theme) {
    return {
        wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      padding-bottom: ", ";\n    "], ["\n      padding-bottom: ", ";\n    "])), theme.spacing(2)),
        cell: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      text-align: right;\n    "], ["\n      text-align: right;\n    "]))),
    };
});
var templateObject_1, templateObject_2;
//# sourceMappingURL=InspectStatsTable.js.map