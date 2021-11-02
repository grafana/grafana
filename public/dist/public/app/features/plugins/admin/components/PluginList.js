import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import { useLocation } from 'react-router-dom';
import { PluginListDisplayMode } from '../types';
import { PluginListItem } from './PluginListItem';
export var PluginList = function (_a) {
    var _b;
    var plugins = _a.plugins, displayMode = _a.displayMode;
    var isList = displayMode === PluginListDisplayMode.List;
    var styles = useStyles2(getStyles);
    var location = useLocation();
    return (React.createElement("div", { className: cx(styles.container, (_b = {}, _b[styles.list] = isList, _b)), "data-testid": "plugin-list" }, plugins.map(function (plugin) { return (React.createElement(PluginListItem, { key: plugin.id, plugin: plugin, pathName: location.pathname, displayMode: displayMode })); })));
};
var getStyles = function (theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: grid;\n      grid-template-columns: repeat(auto-fill, minmax(288px, 1fr));\n      gap: ", ";\n    "], ["\n      display: grid;\n      grid-template-columns: repeat(auto-fill, minmax(288px, 1fr));\n      gap: ", ";\n    "])), theme.spacing(3)),
        list: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      grid-template-columns: 1fr;\n    "], ["\n      grid-template-columns: 1fr;\n    "]))),
    };
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=PluginList.js.map