import { useCallback } from 'react';
import * as React from 'react';

import { DataSourcePluginMeta } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Button } from '@grafana/ui';
import { ROUTES } from 'app/features/connections/constants';
import { addDataSource } from 'app/features/datasources/state';
import { useDispatch } from 'app/types';

import { isDataSourceEditor } from '../../permissions';
import { CatalogPlugin } from '../../types';

type Props = {
  plugin: CatalogPlugin;
};

export function GetStartedWithDataSource({ plugin }: Props): React.ReactElement | null {
  const dispatch = useDispatch();
  const onAddDataSource = useCallback(() => {
    const meta = {
      name: plugin.name,
      id: plugin.id,
    } as DataSourcePluginMeta;

    dispatch(addDataSource(meta, ROUTES.DataSourcesEdit));
  }, [dispatch, plugin]);

  if (!isDataSourceEditor()) {
    return null;
  }

  const disabledButton = config.pluginAdminExternalManageEnabled && !plugin.isFullyInstalled;

  return (
    <Button
      variant="primary"
      onClick={onAddDataSource}
      disabled={disabledButton}
      title={
        disabledButton ? "The plugin isn't usable yet, it may take some time to complete the installation." : undefined
      }
    >
      Add new data source
    </Button>
  );
}
