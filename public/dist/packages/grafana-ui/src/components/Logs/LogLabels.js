import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { stylesFactory } from '../../themes';
import { withTheme } from '../../themes/ThemeContext';
// Levels are already encoded in color, filename is a Loki-ism
var HIDDEN_LABELS = ['level', 'lvl', 'filename'];
var getStyles = stylesFactory(function (theme) {
    return {
        logsLabels: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      flex-wrap: wrap;\n      font-size: ", ";\n    "], ["\n      display: flex;\n      flex-wrap: wrap;\n      font-size: ", ";\n    "])), theme.typography.size.xs),
        logsLabel: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      label: logs-label;\n      display: flex;\n      padding: 0 2px;\n      background-color: ", ";\n      border-radius: ", ";\n      margin: 1px 4px 0 0;\n      text-overflow: ellipsis;\n      white-space: nowrap;\n      overflow: hidden;\n    "], ["\n      label: logs-label;\n      display: flex;\n      padding: 0 2px;\n      background-color: ", ";\n      border-radius: ", ";\n      margin: 1px 4px 0 0;\n      text-overflow: ellipsis;\n      white-space: nowrap;\n      overflow: hidden;\n    "])), theme.colors.bg2, theme.border.radius),
        logsLabelValue: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      label: logs-label__value;\n      display: inline-block;\n      max-width: 20em;\n      text-overflow: ellipsis;\n      overflow: hidden;\n    "], ["\n      label: logs-label__value;\n      display: inline-block;\n      max-width: 20em;\n      text-overflow: ellipsis;\n      overflow: hidden;\n    "]))),
    };
});
export var UnThemedLogLabels = function (_a) {
    var labels = _a.labels, theme = _a.theme;
    var styles = getStyles(theme);
    var displayLabels = Object.keys(labels).filter(function (label) { return !label.startsWith('_') && !HIDDEN_LABELS.includes(label); });
    if (displayLabels.length === 0) {
        return (React.createElement("span", { className: cx([styles.logsLabels]) },
            React.createElement("span", { className: cx([styles.logsLabel]) }, "(no unique labels)")));
    }
    return (React.createElement("span", { className: cx([styles.logsLabels]) }, displayLabels.sort().map(function (label) {
        var value = labels[label];
        if (!value) {
            return;
        }
        var tooltip = label + ": " + value;
        return (React.createElement("span", { key: label, className: cx([styles.logsLabel]) },
            React.createElement("span", { className: cx([styles.logsLabelValue]), title: tooltip }, value)));
    })));
};
export var LogLabels = withTheme(UnThemedLogLabels);
LogLabels.displayName = 'LogLabels';
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=LogLabels.js.map