import { DataSourceRef } from '@grafana/schema/dist/esm/index';

import { useDatasource } from './useDatasource';

export function useDatasourceProps(datasourceRef: DataSourceRef) {
  const { datasourceApi, datasourceSettings, type } = useDatasource(data);
  return {
    name: datasourceSettings?.name,
    type: datasourceSettings?.type,
    logo: datasourceSettings?.meta.t,
  };
}
