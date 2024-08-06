import { useAsync } from 'react-use';

import { getDataSourceSrv } from '@grafana/runtime';
import { DataSourceRef } from '@grafana/schema';

export function useDatasource(dataSourceRef?: DataSourceRef | null) {
  const { value } = useAsync(async () => await getDataSourceSrv().get(dataSourceRef), [dataSourceRef]);
  return value;
}
