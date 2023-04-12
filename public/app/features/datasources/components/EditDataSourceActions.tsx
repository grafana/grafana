import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Button, LinkButton, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';

import { useDataSource, useDataSourceRights, useDeleteLoadedDataSource } from '../state';
import { trackCreateDashboardClicked, trackExploreClicked } from '../tracking';
import { constructDataSourceExploreUrl } from '../utils';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    button: css({
      marginLeft: theme.spacing(2),
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
      <LinkButton
        icon="apps"
        fill="outline"
        variant="secondary"
        href={`dashboard/new-with-ds/${dataSource.uid}`}
        onClick={() => {
          trackCreateDashboardClicked({
            grafana_version: config.buildInfo.version,
            datasource_uid: dataSource.uid,
            plugin_name: dataSource.typeName,
            path: location.pathname,
          });
        }}
      >
        Build a dashboard
      </LinkButton>

      {hasExploreRights && (
        <LinkButton
          icon="compass"
          fill="outline"
          variant="secondary"
          className={styles.button}
          href={constructDataSourceExploreUrl(dataSource)}
          onClick={() => {
            trackExploreClicked({
              grafana_version: config.buildInfo.version,
              datasource_uid: dataSource.uid,
              plugin_name: dataSource.typeName,
              path: location.pathname,
            });
          }}
        >
          Explore
        </LinkButton>
      )}

      <Button type="button" variant="destructive" disabled={!canDelete} onClick={onDelete} className={styles.button}>
        Delete
      </Button>
    </>
  );
}
