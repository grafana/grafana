import React, { FC } from 'react';

import { Badge, BadgeColor, useStyles2 } from '@grafana/ui';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';

import { STATUS_DATA_QA } from './KubernetesClusterStatus.constants';
import { getStyles } from './KubernetesClusterStatus.styles';
import { KubernetesClusterStatusColors, KubernetesClusterStatusProps } from './KubernetesClusterStatus.types';

export const KubernetesClusterStatus: FC<React.PropsWithChildren<KubernetesClusterStatusProps>> = ({ status }) => {
  const styles = useStyles2(getStyles);
  const statusColor: BadgeColor = KubernetesClusterStatusColors[status];

  return (
    <div className={styles.clusterStatusWrapper}>
      <Badge
        text={Messages.kubernetes.kubernetesStatus[status]}
        color={statusColor}
        data-testid={`cluster-status-${STATUS_DATA_QA[status]}`}
      />
    </div>
  );
};
