import { DataSourceSettings } from '@grafana/data';

export function hasCredentials(options: DataSourceSettings<any, any>): boolean {
  return !!options.jsonData.azureCredentials;
}
