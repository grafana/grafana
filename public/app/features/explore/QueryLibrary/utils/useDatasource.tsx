import { useEffect, useState } from 'react';

import { DataSourceApi, DataSourceInstanceSettings } from '@grafana/data';
import { DataSourceRef } from '@grafana/schema/dist/esm/index';

import { getDatasourceSrv } from '../../../plugins/datasource_srv';

export function useDatasource(dataSourceRef?: DataSourceRef | null) {
  const [apiCache, setApiCache] = useState<Record<string, DataSourceApi>>({});
  const [settingsCache, setSettingsCache] = useState<Record<string, DataSourceInstanceSettings>>({});

  useEffect(() => {
    if (!dataSourceRef?.uid) {
      return;
    }

    const uid: string = dataSourceRef.uid;

    if (uid && apiCache[uid] === undefined) {
      getDatasourceSrv()
        .get(dataSourceRef)
        .then((api) => {
          setApiCache({
            ...apiCache,
            [uid]: api,
          });
        });
    }
  }, []);

  useEffect(() => {
    if (!dataSourceRef?.uid) {
      return;
    }

    const uid: string = dataSourceRef.uid;

    if (dataSourceRef.uid && apiCache[dataSourceRef.uid] === undefined) {
      const settings = getDatasourceSrv().getInstanceSettings(dataSourceRef);
      settings &&
        setSettingsCache({
          ...settingsCache,
          [uid]: settings,
        });
    }
  }, []);

  return {
    datasourceApi: dataSourceRef?.uid ? apiCache[dataSourceRef.uid] : undefined,
    datasourceSettings: dataSourceRef?.uid ? settingsCache[dataSourceRef.uid] : undefined,
    type: dataSourceRef?.type || (dataSourceRef?.uid && settingsCache[dataSourceRef.uid]?.type),
  };
}
