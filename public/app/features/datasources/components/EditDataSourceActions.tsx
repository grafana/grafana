import React from 'react';

import { config } from '@grafana/runtime';
import { Button } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';

import { useDataSource, useDataSourceRights, useDeleteLoadedDataSource } from '../state';
import { trackCreateDashboardClicked, trackExploreClicked } from '../tracking';
import { constructDataSourceExploreUrl } from '../utils';

interface Props {
  uid: string;
}

export function EditDataSourceActions({ uid }: Props) {
  const dataSource = useDataSource(uid);
  const onDelete = useDeleteLoadedDataSource();

  const { readOnly, hasDeleteRights } = useDataSourceRights(uid);
  const hasExploreRights = contextSrv.hasPermission(AccessControlAction.DataSourcesExplore);

  const canDelete = !readOnly && hasDeleteRights;

  return (
    <>
      {hasExploreRights && (
        <Button
          type="button"
          variant="secondary"
          disabled={!canDelete}
          onClick={() => {
            trackExploreClicked({
              grafana_version: config.buildInfo.version,
              datasource_uid: dataSource.uid,
              plugin_name: dataSource.typeName,
              path: location.pathname,
            });
            location.href = constructDataSourceExploreUrl(dataSource);
          }}
        >
          Explore data
        </Button>
      )}
      <Button
        type="button"
        variant="secondary"
        disabled={!canDelete}
        onClick={() => {
          trackCreateDashboardClicked({
            grafana_version: config.buildInfo.version,
            datasource_uid: dataSource.uid,
            plugin_name: dataSource.typeName,
            path: location.pathname,
          });
          location.href = `dashboard/new-with-ds/${dataSource.uid}`;
        }}
      >
        View dashboards
      </Button>
      <Button type="button" variant="destructive" disabled={!canDelete} onClick={onDelete}>
        Delete
      </Button>
    </>
  );
}
