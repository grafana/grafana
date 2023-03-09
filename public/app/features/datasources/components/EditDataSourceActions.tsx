import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Button, LinkButton, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';

import { useDataSource, useDataSourceRights, useDeleteLoadedDataSource, useUpdateDatasource } from '../state';
import { trackCreateDashboardClicked, trackExploreClicked } from '../tracking';
import { constructDataSourceExploreUrl } from '../utils';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    button: css({
      marginLeft: theme.spacing(2),
    }),
  };
};

interface ActionsProps {
  uid: string;
}

export function EditDataSourceActions({ uid }: ActionsProps) {
  const styles = useStyles2(getStyles);
  const dataSource = useDataSource(uid);
  const onDelete = useDeleteLoadedDataSource();
  const onUpdate = useUpdateDatasource();

  const { readOnly, hasWriteRights, hasDeleteRights } = useDataSourceRights(uid);
  const hasExploreRights = contextSrv.hasPermission(AccessControlAction.DataSourcesExplore);

  const canSave = !readOnly && hasWriteRights;
  const canDelete = !readOnly && hasDeleteRights;

  const onSubmit = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault();
    await onUpdate({ ...dataSource });
  };

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

      {canSave && (
        <Button
          type="submit"
          variant="primary"
          disabled={!canSave}
          onClick={(event) => onSubmit(event)}
          className={styles.button}
        >
          Save changes
        </Button>
      )}
    </>
  );
}
