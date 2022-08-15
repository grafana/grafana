import React, { useCallback } from 'react';
import { useDispatch } from 'react-redux';

import { DataSourcePluginMeta } from '@grafana/data';
import { Button } from '@grafana/ui';
import { addDataSource } from 'app/features/datasources/state/actions';

import { CatalogPlugin } from '../../../types';
import { isDataSourceEditor } from '../../permissions';

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

    dispatch(addDataSource(meta));
  }, [dispatch, plugin]);

  if (!isDataSourceEditor()) {
    return null;
  }

  return (
    <Button variant="primary" onClick={onAddDataSource}>
      Create a {plugin.name} data source
    </Button>
  );
}
