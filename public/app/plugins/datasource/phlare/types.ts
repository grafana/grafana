import { DataSourceJsonData } from '@grafana/data';

import { GrafanaPyroscope, PhlareQueryType } from './dataquery.gen';

export interface Query extends GrafanaPyroscope {
  queryType: PhlareQueryType;
}

export interface ProfileTypeMessage {
  id: string;
  label: string;
}

/**
 * These are options configured for each DataSource instance.
 */
export interface PhlareDataSourceOptions extends DataSourceJsonData {
  minStep?: string;
  backendType?: BackendType; // if not set we assume it's phlare
}

export type BackendType = 'phlare' | 'pyroscope';
