import { useState } from 'react';
import { useAsync } from 'react-use';

import type { DataSourceApi } from '@grafana/data/types';
import { getDataSourceSrv } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';

export const useDatasourcesFromTargets = (targets: DataQuery[] | undefined): Map<string, DataSourceApi> => {
  const [dataSourcesMap, setDataSourcesMap] = useState(new Map<string, DataSourceApi>());

  useAsync(async () => {
    if (!targets) {
      setDataSourcesMap(new Map<string, DataSourceApi>());
      return;
    }

    const raw = await Promise.all(
      targets
        .filter((target) => !!target.datasource?.uid)
        .map((target) =>
          getDataSourceSrv()
            .get(target.datasource?.uid)
            .then((ds) => ({ key: target.refId, ds }))
        )
    );

    setDataSourcesMap(new Map<string, DataSourceApi>(raw.map(({ key, ds }) => [key, ds])));
  }, [targets]);

  return dataSourcesMap;
};
