import { DataSourceJsonData } from '@grafana/data';

import { Parca as ParcaBase, ParcaQueryType } from './dataquery.gen';

export interface Query extends ParcaBase {
  queryType: ParcaQueryType;
}

export interface ProfileTypeMessage {
  ID: string;
  name: string;
  period_type: string;
  period_unit: string;
  sample_type: string;
  sample_unit: string;
}

/**
 * These are options configured for each DataSource instance.
 */
export interface ParcaDataSourceOptions extends DataSourceJsonData {}
