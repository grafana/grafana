import { DataSourceInstanceSettings, DataSourceJsonData, DataSourceSettings } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import {
  AlertManagerDataSourceJsonData,
  AlertManagerImplementation,
  AlertmanagerChoice,
} from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';
import { RulesSource } from 'app/types/unified-alerting';
import { PromApplication, RulesSourceApplication } from 'app/types/unified-alerting-dto';

import { alertmanagerApi } from '../api/alertmanagerApi';
import { PERMISSIONS_CONTACT_POINTS } from '../components/contact-points/permissions';
import { useAlertManagersByPermission } from '../hooks/useAlertManagerSources';
import { isAlertManagerWithConfigAPI } from '../state/AlertmanagerContext';

import { instancesPermissions, notificationsPermissions, silencesPermissions } from './access-control';
import { getAllDataSources } from './config';

export const GRAFANA_RULES_SOURCE_NAME = 'grafana';
export const GRAFANA_DATASOURCE_NAME = '-- Grafana --';

export enum DataSourceType {
  Alertmanager = 'alertmanager',
  Loki = 'loki',
  Prometheus = 'prometheus',
}

export interface AlertManagerDataSource {
  name: string;
  imgUrl: string;
  meta?: DataSourceInstanceSettings['meta'];
  hasConfigurationAPI?: boolean;
  handleGrafanaManagedAlerts?: boolean;
}

export const RulesDataSourceTypes: string[] = [DataSourceType.Loki, DataSourceType.Prometheus];

export function getRulesDataSources() {
  if (!contextSrv.hasPermission(AccessControlAction.AlertingRuleExternalRead)) {
    return [];
  }

  return getAllDataSources()
    .filter((ds) => RulesDataSourceTypes.includes(ds.type) && ds.jsonData.manageAlerts !== false)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getRulesSourceUniqueKey(rulesSource: RulesSource): string {
  return isGrafanaRulesSource(rulesSource) ? 'grafana' : (rulesSource.uid ?? rulesSource.id);
}

export function getRulesDataSource(rulesSourceName: string) {
  return getRulesDataSources().find((x) => x.name === rulesSourceName);
}

export function getAlertManagerDataSources() {
  return getAllDataSources()
    .filter(isAlertmanagerDataSourceInstance)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function isAlertmanagerDataSourceInstance(
  dataSource: DataSourceInstanceSettings
): dataSource is DataSourceInstanceSettings<AlertManagerDataSourceJsonData> {
  return dataSource.type === DataSourceType.Alertmanager;
}

export function isAlertmanagerDataSource(
  dataSource: DataSourceSettings
): dataSource is DataSourceSettings<AlertManagerDataSourceJsonData> {
  return dataSource.type === DataSourceType.Alertmanager;
}

export function getExternalDsAlertManagers() {
  return getAlertManagerDataSources().filter((ds) => ds.jsonData.handleGrafanaManagedAlerts);
}

export function isAlertmanagerDataSourceInterestedInAlerts(
  dataSourceSettings: DataSourceSettings<AlertManagerDataSourceJsonData>
) {
  return dataSourceSettings.jsonData.handleGrafanaManagedAlerts === true;
}

const grafanaAlertManagerDataSource: AlertManagerDataSource = {
  name: GRAFANA_RULES_SOURCE_NAME,
  imgUrl: 'public/img/grafana_icon.svg',
  hasConfigurationAPI: true,
};

// Used only as a fallback for Alert Group plugin
export function getAllAlertManagerDataSources(): AlertManagerDataSource[] {
  return [
    grafanaAlertManagerDataSource,
    ...getAlertManagerDataSources().map<AlertManagerDataSource>((ds) => ({
      name: ds.name,
      displayName: ds.name,
      imgUrl: ds.meta.info.logos.small,
      meta: ds.meta,
    })),
  ];
}

/**
 * This method gets all alert managers that the user has access, and then filter them first by being able to handle grafana managed alerts,
 * and then depending on the current alerting configuration returns either only the internal alert managers, only the external alert managers, or both.
 *
 */
export function useGetAlertManagerDataSourcesByPermissionAndConfig(
  permission: 'instance' | 'notification'
): AlertManagerDataSource[] {
  const allAlertManagersByPermission = useAlertManagersByPermission(permission); // this hook memoizes the result of getAlertManagerDataSourcesByPermission

  const externalDsAlertManagers: AlertManagerDataSource[] =
    allAlertManagersByPermission.availableExternalDataSources.filter((ds) => ds.handleGrafanaManagedAlerts);
  const internalDSAlertManagers = allAlertManagersByPermission.availableInternalDataSources;

  //get current alerting configuration
  const { currentData: amConfigStatus } = alertmanagerApi.endpoints.getGrafanaAlertingConfigurationStatus.useQuery();

  const alertmanagerChoice = amConfigStatus?.alertmanagersChoice;

  switch (alertmanagerChoice) {
    case AlertmanagerChoice.Internal:
      return internalDSAlertManagers;
    case AlertmanagerChoice.External:
      return externalDsAlertManagers;
    default:
      return [...internalDSAlertManagers, ...externalDsAlertManagers];
  }
}

/**
 * This method gets all alert managers that the user has access to and then split them into two groups:
 * 1. Internal alert managers
 * 2. External alert managers
 */
export function getAlertManagerDataSourcesByPermission(permission: 'instance' | 'notification'): {
  availableInternalDataSources: AlertManagerDataSource[];
  availableExternalDataSources: AlertManagerDataSource[];
} {
  const availableInternalDataSources: AlertManagerDataSource[] = [];
  const availableExternalDataSources: AlertManagerDataSource[] = [];
  const permissions = {
    instance: instancesPermissions.read,
    notification: notificationsPermissions.read,
    silence: silencesPermissions.read,
  };

  const builtinAlertmanagerPermissions = [
    ...Object.values(permissions).flatMap((permissions) => permissions.grafana),
    ...PERMISSIONS_CONTACT_POINTS,
  ];

  const hasPermissionsForInternalAlertmanager = builtinAlertmanagerPermissions.some((permission) =>
    contextSrv.hasPermission(permission)
  );

  if (hasPermissionsForInternalAlertmanager) {
    availableInternalDataSources.push(grafanaAlertManagerDataSource);
  }

  if (contextSrv.hasPermission(permissions[permission].external)) {
    const cloudSources = getAlertManagerDataSources().map<AlertManagerDataSource>((ds) => ({
      name: ds.name,
      displayName: ds.name,
      imgUrl: ds.meta.info.logos.small,
      meta: ds.meta,
      hasConfigurationAPI: isAlertManagerWithConfigAPI(ds.jsonData),
      handleGrafanaManagedAlerts: ds.jsonData.handleGrafanaManagedAlerts,
    }));
    availableExternalDataSources.push(...cloudSources);
  }

  return { availableInternalDataSources, availableExternalDataSources };
}

export function getLotexDataSourceByName(dataSourceName: string): DataSourceInstanceSettings {
  const dataSource = getDataSourceByName(dataSourceName);
  if (!dataSource) {
    throw new Error(`Data source ${dataSourceName} not found`);
  }
  if (dataSource.type !== DataSourceType.Loki && dataSource.type !== DataSourceType.Prometheus) {
    throw new Error(`Unexpected data source type ${dataSource.type}`);
  }
  return dataSource;
}

export function getAllRulesSourceNames(): string[] {
  const availableRulesSources: string[] = getRulesDataSources().map((r) => r.name);

  if (contextSrv.hasPermission(AccessControlAction.AlertingRuleRead)) {
    availableRulesSources.push(GRAFANA_RULES_SOURCE_NAME);
  }

  return availableRulesSources;
}

export function getAllRulesSources(): RulesSource[] {
  const availableRulesSources: RulesSource[] = getRulesDataSources();

  if (contextSrv.hasPermission(AccessControlAction.AlertingRuleRead)) {
    availableRulesSources.push(GRAFANA_RULES_SOURCE_NAME);
  }

  return availableRulesSources;
}

export function getOodleRulesSources(): Array<Exclude<RulesSource, 'grafana'>> {
  return getRulesDataSources().filter(
    (ds) => (
      isCloudRulesSource(ds)
      && ds.type === DataSourceType.Prometheus
      && JSON.stringify(ds.jsonData).toLowerCase().includes('oodle')
    )
  );
}

export function getRulesSourceName(rulesSource: RulesSource): string {
  return isCloudRulesSource(rulesSource) ? rulesSource.name : rulesSource;
}

export function getRulesSourceUid(rulesSource: RulesSource): string {
  return isCloudRulesSource(rulesSource) ? rulesSource.uid : GRAFANA_RULES_SOURCE_NAME;
}

export function isCloudRulesSource(rulesSource: RulesSource | string): rulesSource is DataSourceInstanceSettings {
  return rulesSource !== GRAFANA_RULES_SOURCE_NAME;
}

export function isVanillaPrometheusAlertManagerDataSource(name: string): boolean {
  return (
    name !== GRAFANA_RULES_SOURCE_NAME &&
    getAlertmanagerDataSourceByName(name)?.jsonData?.implementation === AlertManagerImplementation.prometheus
  );
}

export function isProvisionedDataSource(dataSource: DataSourceSettings): boolean {
  return dataSource.readOnly === true;
}

export function isGrafanaRulesSource(
  rulesSource: RulesSource | string
): rulesSource is typeof GRAFANA_RULES_SOURCE_NAME {
  return rulesSource === GRAFANA_RULES_SOURCE_NAME;
}

export function getDataSourceByName(name: string): DataSourceInstanceSettings<DataSourceJsonData> | undefined {
  return getAllDataSources().find((source) => source.name === name);
}

export function getAlertmanagerDataSourceByName(name: string) {
  return getAllDataSources()
    .filter(isAlertmanagerDataSourceInstance)
    .find((source) => source.name === name);
}

export function getRulesSourceByName(name: string): RulesSource | undefined {
  if (name === GRAFANA_RULES_SOURCE_NAME) {
    return GRAFANA_RULES_SOURCE_NAME;
  }
  return getDataSourceByName(name);
}

export function getDatasourceAPIId(dataSourceName: string) {
  if (dataSourceName === GRAFANA_RULES_SOURCE_NAME) {
    return GRAFANA_RULES_SOURCE_NAME;
  }
  const ds = getDataSourceByName(dataSourceName);
  if (!ds) {
    throw new Error(`Datasource "${dataSourceName}" not found`);
  }
  return String(ds.id);
}

export function getDatasourceAPIUid(dataSourceName: string) {
  if (dataSourceName === GRAFANA_RULES_SOURCE_NAME) {
    return GRAFANA_RULES_SOURCE_NAME;
  }
  const ds = getDataSourceByName(dataSourceName);
  if (!ds) {
    throw new Error(`Datasource "${dataSourceName}" not found`);
  }
  return ds.uid;
}

export function getFirstCompatibleDataSource(): DataSourceInstanceSettings<DataSourceJsonData> | undefined {
  return getDataSourceSrv().getList({ alerting: true })[0];
}

export function getDefaultOrFirstCompatibleDataSource(): DataSourceInstanceSettings<DataSourceJsonData> | undefined {
  const defaultDataSource = getDataSourceSrv().getInstanceSettings('default');
  const defaultIsCompatible = defaultDataSource?.meta.alerting ?? false;

  return defaultIsCompatible ? defaultDataSource : getFirstCompatibleDataSource();
}

export function isDataSourceManagingAlerts(ds: DataSourceInstanceSettings<DataSourceJsonData>) {
  return ds.jsonData.manageAlerts !== false; //if this prop is undefined it defaults to true
}

export function getApplicationFromRulesSource(rulesSource: RulesSource): RulesSourceApplication {
  if (isGrafanaRulesSource(rulesSource)) {
    return 'grafana';
  }

  // @TODO use buildinfo
  if ('prometheusType' in rulesSource.jsonData) {
    return rulesSource.jsonData?.prometheusType ?? PromApplication.Prometheus;
  }

  if (rulesSource.type === 'loki') {
    return 'loki';
  }

  return PromApplication.Prometheus; // assume Prometheus if nothing matches
}
