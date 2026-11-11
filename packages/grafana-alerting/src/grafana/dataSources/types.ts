import { type DataSourceJsonData } from '@grafana/data';

export enum AlertManagerImplementation {
  cortex = 'cortex',
  mimir = 'mimir',
  prometheus = 'prometheus',
}

export interface AlertManagerDataSourceJsonData extends DataSourceJsonData {
  implementation?: AlertManagerImplementation;
  handleGrafanaManagedAlerts?: boolean;
}
