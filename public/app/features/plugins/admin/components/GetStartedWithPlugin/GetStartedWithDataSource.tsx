import { DataSourcePluginMeta } from '@grafana/data';
import { Button } from '@grafana/ui';
import { addDataSource } from 'app/features/datasources/state/actions';
import React, { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { CatalogPlugin } from '../../types';

type Props = {
  plugin: CatalogPlugin;
};

export function GetStartedWithDataSource({ plugin }: Props): React.ReactElement {
  const dispatch = useDispatch();
  const onAddDataSource = useCallback(() => {
    const meta = {
      name: plugin.name,
      id: plugin.id,
    } as DataSourcePluginMeta;

    dispatch(addDataSource(meta));
  }, [dispatch, plugin]);

  return (
    <Button variant="primary" onClick={onAddDataSource}>
      Create a {plugin.name} data source
    </Button>
  );
}
