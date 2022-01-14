import React, { FC } from 'react';
import { Icon, useStyles } from '@grafana/ui';
import { getStyles } from './DBClusterName.styles';
import { DBClusterNameProps } from './DBClusterName.types';
import { DASHBOARD_URL_MAP } from './DBClusterName.constants';

export const DBClusterName: FC<DBClusterNameProps> = ({ dbCluster: { clusterName, databaseType } }) => {
  const styles = useStyles(getStyles);
  const getDashboardUrl = DASHBOARD_URL_MAP[databaseType];

  return (
    <div className={styles.clusterNameWrapper}>
      <span>{clusterName}</span>
      <a href={getDashboardUrl(clusterName)} target="_blank" rel="noreferrer noopener" className={styles.dashboardIcon}>
        <Icon name="graph-bar" />
      </a>
    </div>
  );
};
