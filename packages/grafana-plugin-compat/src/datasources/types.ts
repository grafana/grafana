import { type DataSourcePluginMeta } from '@grafana/data';
import { type GetDataSourceListFilters } from '@grafana/runtime';
import { type DataSourceRef } from '@grafana/schema';

export type Ref = DataSourceRef | string | null;

/** Declared here because `@grafana/data` lacks it on older supported hosts. */
export interface DataSourceInstanceListItem {
  uid: string;
  type: string;
  apiVersion?: string;
  name: string;
  meta: DataSourcePluginMeta;
}

/** Declared here because `@grafana/runtime` lacks it on older supported hosts. */
export interface GetDataSourceInstanceListFilters extends Omit<GetDataSourceListFilters, 'filter'> {
  filter?: (item: DataSourceInstanceListItem) => boolean;
}
