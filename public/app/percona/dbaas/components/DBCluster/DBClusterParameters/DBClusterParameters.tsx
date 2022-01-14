import React, { FC } from 'react';

import { useStyles } from '@grafana/ui';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';

import { DBClusterStatus } from '../DBCluster.types';
import { DBClusterConnectionItem } from '../DBClusterConnection/DBClusterConnectionItem/DBClusterConnectionItem';

import { getStyles } from './DBClusterParameters.styles';
import { DBClusterParametersProps } from './DBClusterParameters.types';

export const DBClusterParameters: FC<DBClusterParametersProps> = ({ dbCluster }) => {
  const styles = useStyles(getStyles);
  const { status } = dbCluster;
  const {
    label: exposeLabel,
    enabled: exposeEnabled,
    disabled: exposeDisabled,
  } = Messages.dbcluster.table.parameters.expose;

  return (
    <>
      {status && status === DBClusterStatus.ready && (
        <div className={styles.wrapper}>
          <DBClusterConnectionItem
            label={Messages.dbcluster.table.parameters.clusterName}
            value={dbCluster.kubernetesClusterName}
            dataQa="cluster-parameters-cluster-name"
          />
          <DBClusterConnectionItem
            label={Messages.dbcluster.table.parameters.cpu}
            value={dbCluster.cpu}
            dataQa="cluster-parameters-cpu"
          />
          <DBClusterConnectionItem
            label={Messages.dbcluster.table.parameters.memory}
            value={`${dbCluster.memory} GB`}
            dataQa="cluster-parameters-memory"
          />
          <DBClusterConnectionItem
            label={Messages.dbcluster.table.parameters.disk}
            value={`${dbCluster.disk} GB`}
            dataQa="cluster-parameters-disk"
          />
          <DBClusterConnectionItem
            label={exposeLabel}
            value={dbCluster.expose ? exposeEnabled : exposeDisabled}
            dataQa="cluster-parameters-expose"
          />
        </div>
      )}
    </>
  );
};
