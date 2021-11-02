import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { stylesFactory, useTheme, Tab, TabsBar } from '@grafana/ui';
import { getValueFormat, formattedValueToString } from '@grafana/data';
export var InspectSubtitle = function (_a) {
    var tab = _a.tab, tabs = _a.tabs, onSelectTab = _a.onSelectTab, data = _a.data;
    var theme = useTheme();
    var styles = getStyles(theme);
    return (React.createElement(React.Fragment, null,
        data && React.createElement("div", { className: "muted" }, formatStats(data)),
        React.createElement(TabsBar, { className: styles.tabsBar }, tabs.map(function (t, index) {
            return (React.createElement(Tab, { key: t.value + "-" + index, label: t.label, active: t.value === tab, onChangeTab: function () { return onSelectTab(t); } }));
        }))));
};
var getStyles = stylesFactory(function (theme) {
    return {
        tabsBar: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      padding-left: ", ";\n      margin: ", " -", " -", " -", ";\n    "], ["\n      padding-left: ", ";\n      margin: ", " -", " -", " -", ";\n    "])), theme.spacing.md, theme.spacing.lg, theme.spacing.sm, theme.spacing.lg, theme.spacing.lg),
    };
});
function formatStats(data) {
    var request = data.request;
    if (!request) {
        return '';
    }
    var queryCount = request.targets.length;
    var requestTime = request.endTime ? request.endTime - request.startTime : 0;
    var formatted = formattedValueToString(getValueFormat('ms')(requestTime));
    return queryCount + " queries with total query time of " + formatted;
}
var templateObject_1;
//# sourceMappingURL=InspectSubtitle.js.map