import { __values } from "tslib";
import { PluginType } from '@grafana/data';
import { config } from '../../../core/config';
export function buildCategories(plugins) {
    var e_1, _a, e_2, _b, e_3, _c, e_4, _d;
    var _e;
    var categories = [
        { id: 'tsdb', title: 'Time series databases', plugins: [] },
        { id: 'logging', title: 'Logging & document databases', plugins: [] },
        { id: 'tracing', title: 'Distributed tracing', plugins: [] },
        { id: 'sql', title: 'SQL', plugins: [] },
        { id: 'cloud', title: 'Cloud', plugins: [] },
        { id: 'enterprise', title: 'Enterprise plugins', plugins: [] },
        { id: 'iot', title: 'Industrial & IoT', plugins: [] },
        { id: 'other', title: 'Others', plugins: [] },
    ].filter(function (item) { return item; });
    var categoryIndex = {};
    var pluginIndex = {};
    var enterprisePlugins = getEnterprisePhantomPlugins();
    try {
        // build indices
        for (var categories_1 = __values(categories), categories_1_1 = categories_1.next(); !categories_1_1.done; categories_1_1 = categories_1.next()) {
            var category = categories_1_1.value;
            categoryIndex[category.id] = category;
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (categories_1_1 && !categories_1_1.done && (_a = categories_1.return)) _a.call(categories_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    var _f = config.licenseInfo, edition = _f.edition, hasValidLicense = _f.hasValidLicense;
    var _loop_1 = function (plugin) {
        var e_5, _g;
        var enterprisePlugin = enterprisePlugins.find(function (item) { return item.id === plugin.id; });
        // Force category for enterprise plugins
        if (plugin.enterprise || enterprisePlugin) {
            plugin.category = 'enterprise';
            plugin.unlicensed = edition !== 'Open Source' && !hasValidLicense;
            plugin.info.links = ((_e = enterprisePlugin === null || enterprisePlugin === void 0 ? void 0 : enterprisePlugin.info) === null || _e === void 0 ? void 0 : _e.links) || plugin.info.links;
        }
        // Fix link name
        if (plugin.info.links) {
            try {
                for (var _h = (e_5 = void 0, __values(plugin.info.links)), _j = _h.next(); !_j.done; _j = _h.next()) {
                    var link = _j.value;
                    link.name = 'Learn more';
                }
            }
            catch (e_5_1) { e_5 = { error: e_5_1 }; }
            finally {
                try {
                    if (_j && !_j.done && (_g = _h.return)) _g.call(_h);
                }
                finally { if (e_5) throw e_5.error; }
            }
        }
        var category = categories.find(function (item) { return item.id === plugin.category; }) || categoryIndex['other'];
        category.plugins.push(plugin);
        // add to plugin index
        pluginIndex[plugin.id] = plugin;
    };
    try {
        for (var plugins_1 = __values(plugins), plugins_1_1 = plugins_1.next(); !plugins_1_1.done; plugins_1_1 = plugins_1.next()) {
            var plugin = plugins_1_1.value;
            _loop_1(plugin);
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (plugins_1_1 && !plugins_1_1.done && (_b = plugins_1.return)) _b.call(plugins_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    try {
        for (var categories_2 = __values(categories), categories_2_1 = categories_2.next(); !categories_2_1.done; categories_2_1 = categories_2.next()) {
            var category = categories_2_1.value;
            // add phantom plugin
            if (category.id === 'cloud') {
                category.plugins.push(getGrafanaCloudPhantomPlugin());
            }
            // add phantom plugins
            if (category.id === 'enterprise') {
                try {
                    for (var enterprisePlugins_1 = (e_4 = void 0, __values(enterprisePlugins)), enterprisePlugins_1_1 = enterprisePlugins_1.next(); !enterprisePlugins_1_1.done; enterprisePlugins_1_1 = enterprisePlugins_1.next()) {
                        var plugin = enterprisePlugins_1_1.value;
                        if (!pluginIndex[plugin.id]) {
                            category.plugins.push(plugin);
                        }
                    }
                }
                catch (e_4_1) { e_4 = { error: e_4_1 }; }
                finally {
                    try {
                        if (enterprisePlugins_1_1 && !enterprisePlugins_1_1.done && (_d = enterprisePlugins_1.return)) _d.call(enterprisePlugins_1);
                    }
                    finally { if (e_4) throw e_4.error; }
                }
            }
            sortPlugins(category.plugins);
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (categories_2_1 && !categories_2_1.done && (_c = categories_2.return)) _c.call(categories_2);
        }
        finally { if (e_3) throw e_3.error; }
    }
    // Only show categories with plugins
    return categories.filter(function (c) { return c.plugins.length > 0; });
}
function sortPlugins(plugins) {
    var sortingRules = {
        prometheus: 100,
        graphite: 95,
        loki: 90,
        mysql: 80,
        jaeger: 100,
        postgres: 79,
        gcloud: -1,
    };
    plugins.sort(function (a, b) {
        var aSort = sortingRules[a.id] || 0;
        var bSort = sortingRules[b.id] || 0;
        if (aSort > bSort) {
            return -1;
        }
        if (aSort < bSort) {
            return 1;
        }
        return a.name > b.name ? -1 : 1;
    });
}
function getEnterprisePhantomPlugins() {
    return [
        getPhantomPlugin({
            id: 'grafana-splunk-datasource',
            name: 'Splunk',
            description: 'Visualize and explore Splunk logs',
            imgUrl: 'public/img/plugins/splunk_logo_128.png',
        }),
        getPhantomPlugin({
            id: 'grafana-oracle-datasource',
            name: 'Oracle',
            description: 'Visualize and explore Oracle SQL',
            imgUrl: 'public/img/plugins/oracle.png',
        }),
        getPhantomPlugin({
            id: 'grafana-dynatrace-datasource',
            name: 'Dynatrace',
            description: 'Visualize and explore Dynatrace data',
            imgUrl: 'public/img/plugins/dynatrace.png',
        }),
        getPhantomPlugin({
            id: 'grafana-servicenow-datasource',
            description: 'ServiceNow integration and data source',
            name: 'ServiceNow',
            imgUrl: 'public/img/plugins/servicenow.svg',
        }),
        getPhantomPlugin({
            id: 'grafana-datadog-datasource',
            description: 'DataDog integration and data source',
            name: 'DataDog',
            imgUrl: 'public/img/plugins/datadog.png',
        }),
        getPhantomPlugin({
            id: 'grafana-newrelic-datasource',
            description: 'New Relic integration and data source',
            name: 'New Relic',
            imgUrl: 'public/img/plugins/newrelic.svg',
        }),
        getPhantomPlugin({
            id: 'grafana-mongodb-datasource',
            description: 'MongoDB integration and data source',
            name: 'MongoDB',
            imgUrl: 'public/img/plugins/mongodb.svg',
        }),
        getPhantomPlugin({
            id: 'grafana-snowflake-datasource',
            description: 'Snowflake integration and data source',
            name: 'Snowflake',
            imgUrl: 'public/img/plugins/snowflake.svg',
        }),
        getPhantomPlugin({
            id: 'grafana-wavefront-datasource',
            description: 'Wavefront integration and data source',
            name: 'Wavefront',
            imgUrl: 'public/img/plugins/wavefront.svg',
        }),
        getPhantomPlugin({
            id: 'dlopes7-appdynamics-datasource',
            description: 'AppDynamics integration and data source',
            name: 'AppDynamics',
            imgUrl: 'public/img/plugins/appdynamics.svg',
        }),
        getPhantomPlugin({
            id: 'grafana-saphana-datasource',
            description: 'SAP HANA® integration and data source',
            name: 'SAP HANA®',
            imgUrl: 'public/img/plugins/sap_hana.png',
        }),
        getPhantomPlugin({
            id: 'grafana-honeycomb-datasource',
            description: 'Honeycomb integration and datasource',
            name: 'Honeycomb',
            imgUrl: 'public/img/plugins/honeycomb.png',
        }),
        getPhantomPlugin({
            id: 'grafana-salesforce-datasource',
            description: 'Salesforce integration and datasource',
            name: 'Salesforce',
            imgUrl: 'public/img/plugins/salesforce.svg',
        }),
        getPhantomPlugin({
            id: 'grafana-jira-datasource',
            description: 'Jira integration and datasource',
            name: 'Jira',
            imgUrl: 'public/img/plugins/jira_logo.png',
        }),
        getPhantomPlugin({
            id: 'grafana-gitlab-datasource',
            description: 'GitLab integration and datasource',
            name: 'GitLab',
            imgUrl: 'public/img/plugins/gitlab.svg',
        }),
        getPhantomPlugin({
            id: 'grafana-splunk-monitoring-datasource',
            description: 'SignalFx integration and datasource',
            name: 'Splunk Infrastructure Monitoring',
            imgUrl: 'public/img/plugins/signalfx-logo.svg',
        }),
    ];
}
function getGrafanaCloudPhantomPlugin() {
    return {
        id: 'gcloud',
        name: 'Grafana Cloud',
        type: PluginType.datasource,
        module: 'phantom',
        baseUrl: '',
        info: {
            description: 'Hosted Graphite, Prometheus, and Loki',
            logos: { small: 'public/img/grafana_icon.svg', large: 'asd' },
            author: { name: 'Grafana Labs' },
            links: [
                {
                    url: 'https://grafana.com/products/cloud/',
                    name: 'Learn more',
                },
            ],
            screenshots: [],
            updated: '2019-05-10',
            version: '1.0.0',
        },
    };
}
function getPhantomPlugin(options) {
    return {
        id: options.id,
        name: options.name,
        type: PluginType.datasource,
        module: 'phantom',
        baseUrl: '',
        info: {
            description: options.description,
            logos: { small: options.imgUrl, large: options.imgUrl },
            author: { name: 'Grafana Labs' },
            links: [
                {
                    url: config.pluginCatalogURL + options.id,
                    name: 'Install now',
                },
            ],
            screenshots: [],
            updated: '2019-05-10',
            version: '1.0.0',
        },
    };
}
//# sourceMappingURL=buildCategories.js.map