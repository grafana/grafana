import { DataSourceInstanceSettings } from '@grafana/data';
import { config } from '@grafana/runtime';
import { DataSourceJsonData } from '@grafana/schema';

function getDsInstanceSettingsByUid(dsUid: string): DataSourceInstanceSettings<DataSourceJsonData> | null {
  return Object.values(config.datasources).find((ds) => ds.uid === dsUid) ?? null;
}

export function isAngularDatasourcePlugin(dsUid: string): boolean {
  return getDsInstanceSettingsByUid(dsUid)?.meta.angular?.detected ?? false;
}

export function isAngularDatasourcePluginAndNotHidden(dsUid: string): boolean {
  const settings = getDsInstanceSettingsByUid(dsUid);
  return (settings?.meta.angular?.detected && !settings?.meta.angular.hideDeprecation) ?? false;
}
