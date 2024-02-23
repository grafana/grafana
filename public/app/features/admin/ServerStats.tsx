import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config, GrafanaBootConfig } from '@grafana/runtime';
import { LinkButton, useStyles2 } from '@grafana/ui';
import { AccessControlAction } from 'app/types';

import { contextSrv } from '../../core/services/context_srv';

import { ServerStatsCard } from './ServerStatsCard';
import { getServerStats, ServerStat } from './state/apis';

export const ServerStats = () => {
  const [stats, setStats] = useState<ServerStat | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const styles = useStyles2(getStyles);

  const hasAccessToDataSources = contextSrv.hasPermission(AccessControlAction.DataSourcesRead);
  const hasAccessToAdminUsers = contextSrv.hasPermission(AccessControlAction.UsersRead);

  useEffect(() => {
    if (contextSrv.hasPermission(AccessControlAction.ActionServerStatsRead)) {
      getServerStats().then((stats) => {
        setStats(stats);
        setIsLoading(false);
      });
    }
  }, []);

  if (!contextSrv.hasPermission(AccessControlAction.ActionServerStatsRead)) {
    return null;
  }

  return (
    <>
      <h2 className={styles.title}>Instance statistics</h2>
      {!isLoading && !stats ? (
        <p className={styles.notFound}>No stats found.</p>
      ) : (
        <div className={styles.row}>
          <ServerStatsCard
            isLoading={isLoading}
            content={[
              { name: 'Dashboards (starred)', value: `${stats?.dashboards} (${stats?.stars})` },
              { name: 'Tags', value: stats?.tags },
              { name: 'Playlists', value: stats?.playlists },
              { name: 'Snapshots', value: stats?.snapshots },
            ]}
            footer={
              <LinkButton href={'/dashboards'} variant={'secondary'}>
                Manage dashboards
              </LinkButton>
            }
          />

          <div className={styles.doubleRow}>
            <ServerStatsCard
              isLoading={isLoading}
              content={[{ name: 'Data sources', value: stats?.datasources }]}
              footer={
                hasAccessToDataSources && (
                  <LinkButton href={'/datasources'} variant={'secondary'}>
                    Manage data sources
                  </LinkButton>
                )
              }
            />
            <ServerStatsCard
              isLoading={isLoading}
              content={[{ name: 'Alerts', value: stats?.alerts }]}
              footer={
                <LinkButton href={'/alerting/list'} variant={'secondary'}>
                  Manage alerts
                </LinkButton>
              }
            />
          </div>
          <ServerStatsCard
            isLoading={isLoading}
            content={[
              { name: 'Organisations', value: stats?.orgs },
              { name: 'Users total', value: stats?.users },
              { name: 'Active sessions', value: stats?.activeSessions },
              { name: 'Active users in last 30 days', value: stats?.activeUsers },
              ...getAnonymousStatsContent(stats, config),
            ]}
            footer={
              hasAccessToAdminUsers && (
                <LinkButton href={'/admin/users'} variant={'secondary'}>
                  Manage users
                </LinkButton>
              )
            }
          />
        </div>
      )}
    </>
  );
};

const getAnonymousStatsContent = (stats: ServerStat | null, config: GrafanaBootConfig) => {
  if (!config.anonymousEnabled || !stats?.activeDevices) {
    return [];
  }
  if (!config.anonymousDeviceLimit) {
    return [
      {
        name: 'Active anonymous devices',
        value: `${stats.activeDevices}`,
        tooltip: 'Detected devices that are not logged in, in last 30 days.',
      },
    ];
  } else {
    return [
      {
        name: 'Active anonymous devices',
        value: `${stats.activeDevices} / ${config.anonymousDeviceLimit}`,
        tooltip: 'Detected devices that are not logged in, in last 30 days.',
        highlight: stats.activeDevices > config.anonymousDeviceLimit,
      },
    ];
  }
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    title: css({
      marginBottom: theme.spacing(4),
    }),
    row: css({
      display: 'flex',
      justifyContent: 'space-between',
      width: '100%',

      '& > div:not(:last-of-type)': {
        marginRight: theme.spacing(2),
      },

      '& > div': {
        width: '33.3%',
      },
    }),
    doubleRow: css({
      display: 'flex',
      flexDirection: 'column',

      '& > div:first-of-type': {
        marginBottom: theme.spacing(2),
      },
    }),
    notFound: css({
      fontSize: theme.typography.h6.fontSize,
      textAlign: 'center',
      height: '290px',
    }),
  };
};
