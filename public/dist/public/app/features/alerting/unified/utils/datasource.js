import { __read, __spreadArray } from "tslib";
import { AlertManagerImplementation } from 'app/plugins/datasource/alertmanager/types';
import { getAllDataSources } from './config';
export var GRAFANA_RULES_SOURCE_NAME = 'grafana';
export var DataSourceType;
(function (DataSourceType) {
    DataSourceType["Alertmanager"] = "alertmanager";
    DataSourceType["Loki"] = "loki";
    DataSourceType["Prometheus"] = "prometheus";
})(DataSourceType || (DataSourceType = {}));
export var RulesDataSourceTypes = [DataSourceType.Loki, DataSourceType.Prometheus];
export function getRulesDataSources() {
    return getAllDataSources()
        .filter(function (ds) { return RulesDataSourceTypes.includes(ds.type) && ds.jsonData.manageAlerts !== false; })
        .sort(function (a, b) { return a.name.localeCompare(b.name); });
}
export function getAlertManagerDataSources() {
    return getAllDataSources()
        .filter(function (ds) { return ds.type === DataSourceType.Alertmanager; })
        .sort(function (a, b) { return a.name.localeCompare(b.name); });
}
export function getLotexDataSourceByName(dataSourceName) {
    var dataSource = getDataSourceByName(dataSourceName);
    if (!dataSource) {
        throw new Error("Data source " + dataSourceName + " not found");
    }
    if (dataSource.type !== DataSourceType.Loki && dataSource.type !== DataSourceType.Prometheus) {
        throw new Error("Unexpected data source type " + dataSource.type);
    }
    return dataSource;
}
export function getAllRulesSourceNames() {
    return __spreadArray(__spreadArray([], __read(getRulesDataSources().map(function (r) { return r.name; })), false), [GRAFANA_RULES_SOURCE_NAME], false);
}
export function getAllRulesSources() {
    return __spreadArray(__spreadArray([], __read(getRulesDataSources()), false), [GRAFANA_RULES_SOURCE_NAME], false);
}
export function getRulesSourceName(rulesSource) {
    return isCloudRulesSource(rulesSource) ? rulesSource.name : rulesSource;
}
export function isCloudRulesSource(rulesSource) {
    return rulesSource !== GRAFANA_RULES_SOURCE_NAME;
}
export function isVanillaPrometheusAlertManagerDataSource(name) {
    var _a, _b;
    return (name !== GRAFANA_RULES_SOURCE_NAME &&
        ((_b = (_a = getDataSourceByName(name)) === null || _a === void 0 ? void 0 : _a.jsonData) === null || _b === void 0 ? void 0 : _b.implementation) ===
            AlertManagerImplementation.prometheus);
}
export function isGrafanaRulesSource(rulesSource) {
    return rulesSource === GRAFANA_RULES_SOURCE_NAME;
}
export function getDataSourceByName(name) {
    return getAllDataSources().find(function (source) { return source.name === name; });
}
export function getRulesSourceByName(name) {
    if (name === GRAFANA_RULES_SOURCE_NAME) {
        return GRAFANA_RULES_SOURCE_NAME;
    }
    return getDataSourceByName(name);
}
export function getDatasourceAPIId(dataSourceName) {
    if (dataSourceName === GRAFANA_RULES_SOURCE_NAME) {
        return GRAFANA_RULES_SOURCE_NAME;
    }
    var ds = getDataSourceByName(dataSourceName);
    if (!ds) {
        throw new Error("Datasource \"" + dataSourceName + "\" not found");
    }
    return String(ds.id);
}
//# sourceMappingURL=datasource.js.map