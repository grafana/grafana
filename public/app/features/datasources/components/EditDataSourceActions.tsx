import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Button, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';

import { useDataSource, useDataSourceRights, useDeleteLoadedDataSource } from '../state';
import { trackCreateDashboardClicked, trackExploreClicked } from '../tracking';
import { constructDataSourceExploreUrl } from '../utils';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    button: css({
      marginLeft: theme.spacing(1),
    }),
  };
};

interface Props {
  uid: string;
}

export function EditDataSourceActions({ uid }: Props) {
  const styles = useStyles2(getStyles);
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
          className={styles.button}
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
        className={styles.button}
      >
        View dashboards
      </Button>
      <Button type="button" variant="destructive" disabled={!canDelete} onClick={onDelete} className={styles.button}>
        Delete
      </Button>
    </>
  );
}
