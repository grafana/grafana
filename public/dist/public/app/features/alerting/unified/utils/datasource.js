import { getDataSourceSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AlertManagerImplementation } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';
import { instancesPermissions, notificationsPermissions } from './access-control';
import { getAllDataSources } from './config';
export const GRAFANA_RULES_SOURCE_NAME = 'grafana';
export const GRAFANA_DATASOURCE_NAME = '-- Grafana --';
export var DataSourceType;
(function (DataSourceType) {
    DataSourceType["Alertmanager"] = "alertmanager";
    DataSourceType["Loki"] = "loki";
    DataSourceType["Prometheus"] = "prometheus";
})(DataSourceType || (DataSourceType = {}));
export const RulesDataSourceTypes = [DataSourceType.Loki, DataSourceType.Prometheus];
export function getRulesDataSources() {
    if (!contextSrv.hasPermission(AccessControlAction.AlertingRuleExternalRead)) {
        return [];
    }
    return getAllDataSources()
        .filter((ds) => RulesDataSourceTypes.includes(ds.type) && ds.jsonData.manageAlerts !== false)
        .sort((a, b) => a.name.localeCompare(b.name));
}
export function getRulesDataSource(rulesSourceName) {
    return getRulesDataSources().find((x) => x.name === rulesSourceName);
}
export function getAlertManagerDataSources() {
    return getAllDataSources()
        .filter((ds) => ds.type === DataSourceType.Alertmanager)
        .sort((a, b) => a.name.localeCompare(b.name));
}
export function getExternalDsAlertManagers() {
    return getAlertManagerDataSources().filter((ds) => ds.jsonData.handleGrafanaManagedAlerts);
}
const grafanaAlertManagerDataSource = {
    name: GRAFANA_RULES_SOURCE_NAME,
    imgUrl: 'public/img/grafana_icon.svg',
};
// Used only as a fallback for Alert Group plugin
export function getAllAlertManagerDataSources() {
    return [
        grafanaAlertManagerDataSource,
        ...getAlertManagerDataSources().map((ds) => ({
            name: ds.name,
            displayName: ds.name,
            imgUrl: ds.meta.info.logos.small,
            meta: ds.meta,
        })),
    ];
}
export function getAlertManagerDataSourcesByPermission(permission) {
    const availableDataSources = [];
    const permissions = {
        instance: instancesPermissions.read,
        notification: notificationsPermissions.read,
    };
    if (contextSrv.hasPermission(permissions[permission].grafana)) {
        availableDataSources.push(grafanaAlertManagerDataSource);
    }
    if (contextSrv.hasPermission(permissions[permission].external)) {
        const cloudSources = getAlertManagerDataSources().map((ds) => ({
            name: ds.name,
            displayName: ds.name,
            imgUrl: ds.meta.info.logos.small,
            meta: ds.meta,
        }));
        availableDataSources.push(...cloudSources);
    }
    return availableDataSources;
}
export function getLotexDataSourceByName(dataSourceName) {
    const dataSource = getDataSourceByName(dataSourceName);
    if (!dataSource) {
        throw new Error(`Data source ${dataSourceName} not found`);
    }
    if (dataSource.type !== DataSourceType.Loki && dataSource.type !== DataSourceType.Prometheus) {
        throw new Error(`Unexpected data source type ${dataSource.type}`);
    }
    return dataSource;
}
export function getAllRulesSourceNames() {
    const availableRulesSources = getRulesDataSources().map((r) => r.name);
    if (contextSrv.hasPermission(AccessControlAction.AlertingRuleRead)) {
        availableRulesSources.push(GRAFANA_RULES_SOURCE_NAME);
    }
    return availableRulesSources;
}
export function getAllRulesSources() {
    const availableRulesSources = getRulesDataSources();
    if (contextSrv.hasPermission(AccessControlAction.AlertingRuleRead)) {
        availableRulesSources.push(GRAFANA_RULES_SOURCE_NAME);
    }
    return availableRulesSources;
}
export function getRulesSourceName(rulesSource) {
    return isCloudRulesSource(rulesSource) ? rulesSource.name : rulesSource;
}
export function getRulesSourceUid(rulesSource) {
    return isCloudRulesSource(rulesSource) ? rulesSource.uid : GRAFANA_RULES_SOURCE_NAME;
}
export function isCloudRulesSource(rulesSource) {
    return rulesSource !== GRAFANA_RULES_SOURCE_NAME;
}
export function isVanillaPrometheusAlertManagerDataSource(name) {
    var _a, _b;
    return (name !== GRAFANA_RULES_SOURCE_NAME &&
        ((_b = (_a = getAlertmanagerDataSourceByName(name)) === null || _a === void 0 ? void 0 : _a.jsonData) === null || _b === void 0 ? void 0 : _b.implementation) === AlertManagerImplementation.prometheus);
}
export function isGrafanaRulesSource(rulesSource) {
    return rulesSource === GRAFANA_RULES_SOURCE_NAME;
}
export function getDataSourceByName(name) {
    return getAllDataSources().find((source) => source.name === name);
}
export function getAlertmanagerDataSourceByName(name) {
    return getAllDataSources().find((source) => source.name === name && source.type === 'alertmanager');
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
    const ds = getDataSourceByName(dataSourceName);
    if (!ds) {
        throw new Error(`Datasource "${dataSourceName}" not found`);
    }
    return String(ds.id);
}
export function getDatasourceAPIUid(dataSourceName) {
    if (dataSourceName === GRAFANA_RULES_SOURCE_NAME) {
        return GRAFANA_RULES_SOURCE_NAME;
    }
    const ds = getDataSourceByName(dataSourceName);
    if (!ds) {
        throw new Error(`Datasource "${dataSourceName}" not found`);
    }
    return ds.uid;
}
export function getFirstCompatibleDataSource() {
    return getDataSourceSrv().getList({ alerting: true })[0];
}
export function getDefaultOrFirstCompatibleDataSource() {
    var _a;
    const defaultDataSource = getDataSourceSrv().getInstanceSettings('default');
    const defaultIsCompatible = (_a = defaultDataSource === null || defaultDataSource === void 0 ? void 0 : defaultDataSource.meta.alerting) !== null && _a !== void 0 ? _a : false;
    return defaultIsCompatible ? defaultDataSource : getFirstCompatibleDataSource();
}
export function isDataSourceManagingAlerts(ds) {
    return ds.jsonData.manageAlerts !== false; //if this prop is undefined it defaults to true
}
//# sourceMappingURL=datasource.js.map