import { useEffect, useState } from 'react';

import { DataSourceApi } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { DataSourceRef } from '@grafana/schema/dist/esm/index';

export function useDatasource(dataSourceRef?: DataSourceRef | null) {
  const [apiCache, setApiCache] = useState<Record<string, DataSourceApi>>({});

  useEffect(() => {
    if (!dataSourceRef?.uid) {
      return;
    }

    const uid: string = dataSourceRef.uid;

    if (uid && apiCache[uid] === undefined) {
      getDataSourceSrv()
        .get(dataSourceRef)
        .then((api) => {
          setApiCache({
            ...apiCache,
            [uid]: api,
          });
        });
    }
  }, []);

  return dataSourceRef?.uid ? apiCache[dataSourceRef.uid] : undefined;
}
