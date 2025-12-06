import { useEffect, useState } from 'react';

import { DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

export function useTrinoDataSource(configuredUid?: string): DataSourceInstanceSettings | null {
  const [trinoDataSource, setTrinoDataSource] = useState<DataSourceInstanceSettings | null>(null);

  useEffect(() => {
    const findTrinoDataSource = () => {
      try {
        const dataSources = getDataSourceSrv().getList();
        
        let trino: DataSourceInstanceSettings | undefined;
        
        if (configuredUid) {
          trino = dataSources.find((ds) => ds.uid === configuredUid && ds.type === 'trino-datasource');
          
          if (!trino) {
            console.warn(`Configured Trino datasource with UID '${configuredUid}' not found or not of type 'trino-datasource'`);
          }
        } else {
          trino = dataSources.find((ds) => ds.type === 'trino-datasource');
        }
        
        setTrinoDataSource(trino ?? null);
      } catch (error) {
        console.error('Error finding Trino datasource:', error);
        setTrinoDataSource(null);
      }
    };

    findTrinoDataSource();
  }, [configuredUid]);

  return trinoDataSource;
}

