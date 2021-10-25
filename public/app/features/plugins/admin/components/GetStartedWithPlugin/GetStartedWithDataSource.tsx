import { DataSourcePluginMeta } from '@grafana/data';
import { Button } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { addDataSource } from 'app/features/datasources/state/actions';
import { AccessControlAction } from 'app/types';
import React, { useCallback } from 'react';
import { useDispatch } from 'react-redux';
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

    dispatch(addDataSource(meta));
  }, [dispatch, plugin]);

  if (!hasPermissionToCreateDataSource()) {
    return null;
  }

  return (
    <Button variant="primary" onClick={onAddDataSource}>
      Create a {plugin.name} data source
    </Button>
  );
}

function hasPermissionToCreateDataSource(): boolean {
  return (
    contextSrv.hasPermission(AccessControlAction.DataSourcesCreate) &&
    contextSrv.hasPermission(AccessControlAction.DataSourcesWrite)
  );
}
