import { type DataSourceInstanceListItem } from '@grafana/data';
import { type GetDataSourceListFilters } from '@grafana/runtime';
import { type DataSourceRef } from '@grafana/schema';

export type Ref = DataSourceRef | string | null;

/** Declared here because `@grafana/runtime` lacks it on older supported hosts. */
export type GetDataSourceInstanceListFilters = Omit<GetDataSourceListFilters, 'filter'> & {
  filter?: (item: DataSourceInstanceListItem) => boolean;
};
