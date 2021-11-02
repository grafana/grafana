import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { useStyles2, Icon } from '@grafana/ui';
import { PluginIconName } from '../types';
export function PluginDetailsHeaderDependencies(_a) {
    var _b, _c;
    var plugin = _a.plugin, className = _a.className;
    var styles = useStyles2(getStyles);
    var pluginDependencies = (_b = plugin.details) === null || _b === void 0 ? void 0 : _b.pluginDependencies;
    var grafanaDependency = (_c = plugin.details) === null || _c === void 0 ? void 0 : _c.grafanaDependency;
    var hasNoDependencyInfo = !grafanaDependency && (!pluginDependencies || !pluginDependencies.length);
    if (hasNoDependencyInfo) {
        return null;
    }
    return (React.createElement("div", { className: className },
        React.createElement("div", { className: styles.dependencyTitle }, "Dependencies:"),
        Boolean(grafanaDependency) && (React.createElement("div", null,
            React.createElement(Icon, { name: "grafana", className: styles.icon }),
            "Grafana ",
            grafanaDependency)),
        pluginDependencies && pluginDependencies.length > 0 && (React.createElement("div", null, pluginDependencies.map(function (p) {
            return (React.createElement("span", { key: p.name },
                React.createElement(Icon, { name: PluginIconName[p.type], className: styles.icon }),
                p.name,
                " ",
                p.version));
        })))));
}
export var getStyles = function (theme) {
    return {
        dependencyTitle: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      font-weight: ", ";\n      margin-right: ", ";\n\n      &::after {\n        content: '';\n        padding: 0;\n      }\n    "], ["\n      font-weight: ", ";\n      margin-right: ", ";\n\n      &::after {\n        content: '';\n        padding: 0;\n      }\n    "])), theme.typography.fontWeightBold, theme.spacing(0.5)),
        icon: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      color: ", ";\n      margin-right: ", ";\n    "], ["\n      color: ", ";\n      margin-right: ", ";\n    "])), theme.colors.text.secondary, theme.spacing(0.5)),
    };
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=PluginDetailsHeaderDependencies.js.map