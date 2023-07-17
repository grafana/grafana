import React, { useCallback } from 'react';

import { DataSourcePluginMeta } from '@grafana/data';
import { Button } from '@grafana/ui';
import { ROUTES } from 'app/features/connections/constants';
import { addDataSource } from 'app/features/connections/state';
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

  return (
    <Button variant="primary" onClick={onAddDataSource}>
      Add new data source
    </Button>
  );
}
