import { useEffect, useState } from 'react';

import { DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

// checks if the trino datasource is available. if it is, it returns that. otherwise returns null.
export function useTrinoDataSource(): DataSourceInstanceSettings | null {
  const [trinoDataSource, setTrinoDataSource] = useState<DataSourceInstanceSettings | null>(null);

  useEffect(() => {
    const findTrinoDataSource = () => {
      try {
        const dataSources = getDataSourceSrv().getList();
        
        const trino = dataSources.find(
          (ds) =>
            ds.type === 'trino-datasource'
        );
        
        setTrinoDataSource(trino ?? null);
      } catch (error) {
        console.error('Error finding Trino datasource:', error);
        setTrinoDataSource(null);
      }
    };

    findTrinoDataSource();
  }, []);

  return trinoDataSource;
}

