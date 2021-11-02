import { __read, __spreadArray, __values } from "tslib";
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { PluginIncludeType, PluginType } from '@grafana/data';
import { PluginTabIds } from '../types';
import { usePluginConfig } from '../hooks/usePluginConfig';
import { isOrgAdmin } from '../permissions';
export var usePluginDetailsTabs = function (plugin, defaultTabs) {
    if (defaultTabs === void 0) { defaultTabs = []; }
    var _a = usePluginConfig(plugin), loading = _a.loading, error = _a.error, pluginConfig = _a.value;
    var pathname = useLocation().pathname;
    var tabs = useMemo(function () {
        var e_1, _a;
        var _b;
        var canConfigurePlugins = isOrgAdmin();
        var tabs = __spreadArray([], __read(defaultTabs), false);
        // Not extending the tabs with the config pages if the plugin is not installed
        if (!pluginConfig) {
            return tabs;
        }
        if (canConfigurePlugins) {
            if (pluginConfig.meta.type === PluginType.app) {
                if (pluginConfig.angularConfigCtrl) {
                    tabs.push({
                        label: 'Config',
                        icon: 'cog',
                        id: PluginTabIds.CONFIG,
                        href: pathname + "?page=" + PluginTabIds.CONFIG,
                    });
                }
                if (pluginConfig.configPages) {
                    try {
                        for (var _c = __values(pluginConfig.configPages), _d = _c.next(); !_d.done; _d = _c.next()) {
                            var page = _d.value;
                            tabs.push({
                                label: page.title,
                                icon: page.icon,
                                id: page.id,
                                href: pathname + "?page=" + page.id,
                            });
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                }
                if ((_b = pluginConfig.meta.includes) === null || _b === void 0 ? void 0 : _b.find(function (include) { return include.type === PluginIncludeType.dashboard; })) {
                    tabs.push({
                        label: 'Dashboards',
                        icon: 'apps',
                        id: PluginTabIds.DASHBOARDS,
                        href: pathname + "?page=" + PluginTabIds.DASHBOARDS,
                    });
                }
            }
        }
        return tabs;
    }, [pluginConfig, defaultTabs, pathname]);
    return {
        error: error,
        loading: loading,
        tabs: tabs,
    };
};
//# sourceMappingURL=usePluginDetailsTabs.js.map