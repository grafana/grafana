import React, { useCallback } from 'react';

import { DataSourcePluginMeta } from '@grafana/data';
import { Button } from '@grafana/ui';
import { useDataSourcesRoutes, addDataSource } from 'app/features/datasources/state';
import { useDispatch } from 'app/types';

import { isDataSourceEditor } from '../../permissions';
import { CatalogPlugin } from '../../types';

type Props = {
  plugin: CatalogPlugin;
};

export function GetStartedWithDataSource({ plugin }: Props): React.ReactElement | null {
  const dispatch = useDispatch();
  const dataSourcesRoutes = useDataSourcesRoutes();
  const onAddDataSource = useCallback(() => {
    const meta = {
      name: plugin.name,
      id: plugin.id,
    } as DataSourcePluginMeta;

    dispatch(addDataSource(meta, dataSourcesRoutes.Edit));
  }, [dispatch, plugin, dataSourcesRoutes]);

  if (!isDataSourceEditor()) {
    return null;
  }

  return (
    <Button variant="primary" onClick={onAddDataSource}>
      Create a {plugin.name} data source
    </Button>
  );
}
