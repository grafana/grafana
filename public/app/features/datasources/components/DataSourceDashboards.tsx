import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { getBackendSrv } from '@grafana/runtime';
import { Card, useStyles2 } from '@grafana/ui';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { importDashboard, removeDashboard } from 'app/features/dashboard/state/actions';
import { loadPluginDashboards } from 'app/features/plugins/admin/state/actions';
import { PluginDashboard, StoreState, useDispatch, useSelector } from 'app/types';

import DashboardTable from '../components/DashboardsTable';
import { useInitDataSourceSettings } from '../state';

export type Props = {
  // The UID of the data source
  uid: string;
};

export function DataSourceDashboards({ uid }: Props) {
  useInitDataSourceSettings(uid);

  const dispatch = useDispatch();
  const dataSource = useSelector((s: StoreState) => s.dataSources.dataSource);
  const dashboards = useSelector((s: StoreState) => s.plugins.dashboards);
  const isLoading = useSelector((s: StoreState) => s.plugins.isLoadingPluginDashboards);
  const [userDashboards, setUserDashboards] = useState([]);

  useEffect(() => {
    // Load plugin dashboards only when the datasource has loaded
    if (dataSource.id > 0) {
      dispatch(loadPluginDashboards());
      getBackendSrv().get(`api/search?limit=1000&tag=${uid}`)
        .then(userDash => {
          setUserDashboards(userDash)
        })
    }
  }, [dispatch, dataSource.id, uid]);

  const onImportDashboard = (dashboard: PluginDashboard, overwrite: boolean) => {
    dispatch(
      importDashboard(
        {
          pluginId: dashboard.pluginId,
          path: dashboard.path,
          overwrite,
          inputs: [
            {
              name: '*',
              type: 'datasource',
              pluginId: dataSource.type,
              value: dataSource.name,
            },
          ],
        },
        dashboard.title
      )
    );
  };

  const onRemoveDashboard = ({ uid }: PluginDashboard) => {
    dispatch(removeDashboard(uid));
  };

  return (
    <DataSourceDashboardsView
      userDashboards={userDashboards}
      dashboards={dashboards}
      isLoading={isLoading}
      onImportDashboard={onImportDashboard}
      onRemoveDashboard={onRemoveDashboard}
    />
  );
}

type UserDashboard = {
  screenshot: string
  title: string
  url: string
}

export type ViewProps = {
  isLoading: boolean;
  dashboards: PluginDashboard[];
  userDashboards: UserDashboard[]
  onImportDashboard: (dashboard: PluginDashboard, overwrite: boolean) => void;
  onRemoveDashboard: (dashboard: PluginDashboard) => void;
};

export const DataSourceDashboardsView = ({
  isLoading,
  dashboards,
  userDashboards,
  onImportDashboard,
  onRemoveDashboard,
}: ViewProps) => {
  const styles = useStyles2(getStyles);

  if (isLoading) {
    return <PageLoader />;
  }
  return (
    <>
      <div className={styles.starterDashboard}>
        <h3>Starter Dashboards from Grafana</h3>
        <DashboardTable dashboards={dashboards} onImport={onImportDashboard} onRemove={onRemoveDashboard} />
      </div>

      <div>
        <h3>Dashboards that feature this datasource:</h3>
        {userDashboards.map((userDashboard) => {
          return (
            <Card href={userDashboard.url} key={userDashboard.url}>
              <Card.Heading>{userDashboard.title}</Card.Heading>
              <Card.Meta>
                {/* Ok all of this is obviously fictional, I'm just dreaming a bit */}
                <p>Created by: Amazing Dev</p>
                <p>Created at: 1/1/2023</p>
                <p>Viewed: 1 million times</p>
                <p>Last Viewed: yesterday</p>
              </Card.Meta>
              <Card.Description><img className={styles.screenshot} src={userDashboard.screenshot} alt="screenshot of a dashboard that uses this datasource" /></Card.Description>
            </Card>
          )
        })}
      </div>
    </>
  );
};


function getStyles() {
  return {
    screenshot: css({
      maxWidth: "600px",
    }),
    starterDashboard: css({
      paddingBottom: "50px", 
    })
  };
}
