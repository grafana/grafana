import { __values } from "tslib";
import { PluginType } from '@grafana/data';
import config from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
export function buildNavModel(dataSource, plugin) {
    var e_1, _a;
    var pluginMeta = plugin.meta;
    var navModel = {
        img: pluginMeta.info.logos.large,
        id: 'datasource-' + dataSource.uid,
        subTitle: "Type: " + pluginMeta.name,
        url: '',
        text: dataSource.name,
        breadcrumbs: [{ title: 'Data Sources', url: 'datasources' }],
        children: [
            {
                active: false,
                icon: 'sliders-v-alt',
                id: "datasource-settings-" + dataSource.uid,
                text: 'Settings',
                url: "datasources/edit/" + dataSource.uid + "/",
            },
        ],
    };
    if (plugin.configPages) {
        try {
            for (var _b = __values(plugin.configPages), _c = _b.next(); !_c.done; _c = _b.next()) {
                var page = _c.value;
                navModel.children.push({
                    active: false,
                    text: page.title,
                    icon: page.icon,
                    url: "datasources/edit/" + dataSource.uid + "/?page=" + page.id,
                    id: "datasource-page-" + page.id,
                });
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    if (pluginMeta.includes && hasDashboards(pluginMeta.includes)) {
        navModel.children.push({
            active: false,
            icon: 'apps',
            id: "datasource-dashboards-" + dataSource.uid,
            text: 'Dashboards',
            url: "datasources/edit/" + dataSource.uid + "/dashboards",
        });
    }
    if (config.licenseInfo.hasLicense) {
        if (contextSrv.hasPermission(AccessControlAction.DataSourcesPermissionsRead)) {
            navModel.children.push({
                active: false,
                icon: 'lock',
                id: "datasource-permissions-" + dataSource.id,
                text: 'Permissions',
                url: "datasources/edit/" + dataSource.id + "/permissions",
            });
        }
        navModel.children.push({
            active: false,
            icon: 'info-circle',
            id: "datasource-insights-" + dataSource.id,
            text: 'Insights',
            url: "datasources/edit/" + dataSource.id + "/insights",
        });
        navModel.children.push({
            active: false,
            icon: 'database',
            id: "datasource-cache-" + dataSource.uid,
            text: 'Cache',
            url: "datasources/edit/" + dataSource.uid + "/cache",
            hideFromTabs: !pluginMeta.isBackend || !config.caching.enabled,
        });
    }
    return navModel;
}
export function getDataSourceNav(main, pageName) {
    var e_2, _a;
    var node;
    try {
        // find active page
        for (var _b = __values(main.children), _c = _b.next(); !_c.done; _c = _b.next()) {
            var child = _c.value;
            if (child.id.indexOf(pageName) > 0) {
                child.active = true;
                node = child;
                break;
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return {
        main: main,
        node: node,
    };
}
export function getDataSourceLoadingNav(pageName) {
    var main = buildNavModel({
        access: '',
        basicAuth: false,
        basicAuthUser: '',
        basicAuthPassword: '',
        withCredentials: false,
        database: '',
        id: 1,
        uid: 'x',
        isDefault: false,
        jsonData: { authType: 'credentials', defaultRegion: 'eu-west-2' },
        name: 'Loading',
        orgId: 1,
        password: '',
        readOnly: false,
        type: 'Loading',
        typeName: 'Loading',
        typeLogoUrl: 'public/img/icn-datasource.svg',
        url: '',
        user: '',
        secureJsonFields: {},
    }, {
        meta: {
            id: '1',
            type: PluginType.datasource,
            name: '',
            info: {
                author: {
                    name: '',
                    url: '',
                },
                description: '',
                links: [{ name: '', url: '' }],
                logos: {
                    large: '',
                    small: '',
                },
                screenshots: [],
                updated: '',
                version: '',
            },
            includes: [],
            module: '',
            baseUrl: '',
        },
    });
    return getDataSourceNav(main, pageName);
}
function hasDashboards(includes) {
    return (includes.find(function (include) {
        return include.type === 'dashboard';
    }) !== undefined);
}
//# sourceMappingURL=navModel.js.map