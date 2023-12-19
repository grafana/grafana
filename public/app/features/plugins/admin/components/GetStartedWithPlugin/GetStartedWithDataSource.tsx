import React, { useCallback } from 'react';

import { DataSourcePluginMeta } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Button } from '@grafana/ui';
import configCore from 'app/core/config';
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
    <Button
      variant="primary"
      onClick={onAddDataSource}
      disabled={
        configCore.featureToggles.managedPluginsInstall &&
        config.pluginAdminExternalManageEnabled &&
        !plugin.isFullyInstalled
      }
    >
      Add new data source
    </Button>
  );
}
