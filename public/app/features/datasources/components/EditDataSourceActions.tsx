import React from 'react';

import { config } from '@grafana/runtime';
import { LinkButton } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
// @todo: replace barrel import path
import { AccessControlAction } from 'app/types/index';

// @todo: replace barrel import path
import { useDataSource } from '../state/index';
import { trackCreateDashboardClicked, trackDsConfigClicked, trackExploreClicked } from '../tracking';
import { constructDataSourceExploreUrl } from '../utils';

interface Props {
  uid: string;
}

export function EditDataSourceActions({ uid }: Props) {
  const dataSource = useDataSource(uid);
  const hasExploreRights = contextSrv.hasPermission(AccessControlAction.DataSourcesExplore);

  return (
    <>
      {hasExploreRights && (
        <LinkButton
          variant="secondary"
          size="sm"
          href={constructDataSourceExploreUrl(dataSource)}
          onClick={() => {
            trackDsConfigClicked('explore');
            trackExploreClicked({
              grafana_version: config.buildInfo.version,
              datasource_uid: dataSource.uid,
              plugin_name: dataSource.typeName,
              path: location.pathname,
            });
          }}
        >
          Explore data
        </LinkButton>
      )}
      <LinkButton
        size="sm"
        variant="secondary"
        href={`dashboard/new-with-ds/${dataSource.uid}`}
        onClick={() => {
          trackDsConfigClicked('build_a_dashboard');
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
    </>
  );
}
