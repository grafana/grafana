import { DataSourceSettings } from '@grafana/data';

export function dataSourceHasCredentials(options: DataSourceSettings<any, any>): boolean {
  return !!options.jsonData.azureCredentials;
}

export const setDataSourceCredentials: (config: DataSourceSettings<any, any>, enabled: boolean) =>
      enabled ? setDefaultCredentials(config) : resetCredentials(config),