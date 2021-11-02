import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { PluginType } from '@grafana/data';
import { Tooltip, useStyles2 } from '@grafana/ui';
export function PluginUpdateAvailableBadge(_a) {
    var plugin = _a.plugin;
    var styles = useStyles2(getStyles);
    if (plugin.hasUpdate && !plugin.isCore && plugin.type !== PluginType.renderer) {
        return (React.createElement(Tooltip, { content: plugin.version },
            React.createElement("p", { className: styles.hasUpdate }, "Update available!")));
    }
    return null;
}
export var getStyles = function (theme) {
    return {
        hasUpdate: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      color: ", ";\n      font-size: ", ";\n      margin-bottom: 0;\n    "], ["\n      color: ", ";\n      font-size: ", ";\n      margin-bottom: 0;\n    "])), theme.colors.text.secondary, theme.typography.bodySmall.fontSize),
    };
};
var templateObject_1;
//# sourceMappingURL=PluginUpdateAvailableBadge.js.map