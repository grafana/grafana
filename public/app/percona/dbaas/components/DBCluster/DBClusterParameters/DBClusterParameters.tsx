import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { DBClusterParametersProps } from './DBClusterParameters.types';
import { DBClusterStatus } from '../DBCluster.types';
import { getStyles } from './DBClusterParameters.styles';
import { DBClusterConnectionItem } from '../DBClusterConnection/DBClusterConnectionItem/DBClusterConnectionItem';

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
            dataTestId="cluster-parameters-cluster-name"
          />
          <DBClusterConnectionItem
            label={Messages.dbcluster.table.parameters.cpu}
            value={dbCluster.cpu}
            dataTestId="cluster-parameters-cpu"
          />
          <DBClusterConnectionItem
            label={Messages.dbcluster.table.parameters.memory}
            value={`${dbCluster.memory} GB`}
            dataTestId="cluster-parameters-memory"
          />
          <DBClusterConnectionItem
            label={Messages.dbcluster.table.parameters.disk}
            value={`${dbCluster.disk} GB`}
            dataTestId="cluster-parameters-disk"
          />
          <DBClusterConnectionItem
            label={exposeLabel}
            value={dbCluster.expose ? exposeEnabled : exposeDisabled}
            dataTestId="cluster-parameters-expose"
          />
        </div>
      )}
    </>
  );
};
