import { __makeTemplateObject, __values } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import { PluginTabIds } from '../types';
import { VersionList } from '../components/VersionList';
import { usePluginConfig } from '../hooks/usePluginConfig';
import { AppConfigCtrlWrapper } from '../../wrappers/AppConfigWrapper';
import { PluginDashboards } from '../../PluginDashboards';
export function PluginDetailsBody(_a) {
    var e_1, _b;
    var _c, _d, _e;
    var plugin = _a.plugin, queryParams = _a.queryParams;
    var styles = useStyles2(getStyles);
    var pluginConfig = usePluginConfig(plugin).value;
    var pageId = queryParams.page;
    if (pageId === PluginTabIds.OVERVIEW) {
        return (React.createElement("div", { className: cx(styles.readme, styles.container), dangerouslySetInnerHTML: {
                __html: (_d = (_c = plugin.details) === null || _c === void 0 ? void 0 : _c.readme) !== null && _d !== void 0 ? _d : 'No plugin help or readme markdown file was found',
            } }));
    }
    if (pageId === PluginTabIds.VERSIONS) {
        return (React.createElement("div", { className: styles.container },
            React.createElement(VersionList, { versions: (_e = plugin.details) === null || _e === void 0 ? void 0 : _e.versions })));
    }
    if (pageId === PluginTabIds.CONFIG && (pluginConfig === null || pluginConfig === void 0 ? void 0 : pluginConfig.angularConfigCtrl)) {
        return (React.createElement("div", { className: styles.container },
            React.createElement(AppConfigCtrlWrapper, { app: pluginConfig })));
    }
    if (pluginConfig === null || pluginConfig === void 0 ? void 0 : pluginConfig.configPages) {
        try {
            for (var _f = __values(pluginConfig.configPages), _g = _f.next(); !_g.done; _g = _f.next()) {
                var configPage = _g.value;
                if (pageId === configPage.id) {
                    return (React.createElement("div", { className: styles.container },
                        React.createElement(configPage.body, { plugin: pluginConfig, query: queryParams })));
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_g && !_g.done && (_b = _f.return)) _b.call(_f);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    if (pageId === PluginTabIds.DASHBOARDS && pluginConfig) {
        return (React.createElement("div", { className: styles.container },
            React.createElement(PluginDashboards, { plugin: pluginConfig === null || pluginConfig === void 0 ? void 0 : pluginConfig.meta })));
    }
    return (React.createElement("div", { className: styles.container },
        React.createElement("p", null, "Page not found.")));
}
export var getStyles = function (theme) { return ({
    container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    padding: ", ";\n  "], ["\n    padding: ", ";\n  "])), theme.spacing(3, 4)),
    readme: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    & img {\n      max-width: 100%;\n    }\n\n    h1,\n    h2,\n    h3 {\n      margin-top: ", ";\n      margin-bottom: ", ";\n    }\n\n    *:first-child {\n      margin-top: 0;\n    }\n\n    li {\n      margin-left: ", ";\n      & > p {\n        margin: ", " 0;\n      }\n    }\n  "], ["\n    & img {\n      max-width: 100%;\n    }\n\n    h1,\n    h2,\n    h3 {\n      margin-top: ", ";\n      margin-bottom: ", ";\n    }\n\n    *:first-child {\n      margin-top: 0;\n    }\n\n    li {\n      margin-left: ", ";\n      & > p {\n        margin: ", " 0;\n      }\n    }\n  "])), theme.spacing(3), theme.spacing(2), theme.spacing(2), theme.spacing()),
}); };
var templateObject_1, templateObject_2;
//# sourceMappingURL=PluginDetailsBody.js.map