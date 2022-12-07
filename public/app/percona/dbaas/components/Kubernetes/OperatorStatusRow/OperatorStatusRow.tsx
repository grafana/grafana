import React, { FC, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';

import { useStyles } from '@grafana/ui/src';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';

import { Databases } from '../../../../shared/core';
import { selectKubernetesCluster } from '../../../../shared/core/reducers';
import { AddClusterButton } from '../../AddClusterButton/AddClusterButton';
import { DB_CLUSTER_CREATION_URL } from '../../DBCluster/EditDBClusterPage/EditDBClusterPage.constants';
import { Kubernetes, OperatorToUpdate } from '../Kubernetes.types';
import { KubernetesClusterStatus } from '../KubernetesClusterStatus/KubernetesClusterStatus.types';
import { KubernetesOperatorStatus } from '../OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';
import { OperatorStatusItem } from '../OperatorStatusItem/OperatorStatusItem';

import { getStyles } from './OperatorStatusRow.styles';

interface OperatorStatusRowProps {
  element: Kubernetes;
  setSelectedCluster: React.Dispatch<React.SetStateAction<Kubernetes | null>>;
  setOperatorToUpdate: React.Dispatch<React.SetStateAction<OperatorToUpdate | null>>;
  setUpdateOperatorModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

export const OperatorStatusRow: FC<OperatorStatusRowProps> = ({
  element,
  setSelectedCluster,
  setOperatorToUpdate,
  setUpdateOperatorModalVisible,
}) => {
  const styles = useStyles(getStyles);
  const history = useHistory();
  const dispatch = useDispatch();
  const isDisabled = useMemo(
    () =>
      element.status !== KubernetesClusterStatus.ok ||
      !(
        element?.operators?.pxc?.status === KubernetesOperatorStatus.ok ||
        element?.operators?.psmdb?.status === KubernetesOperatorStatus.ok
      ),
    [element]
  );

  return (
    <div data-testid={`${element.kubernetesClusterName}-kubernetes-row-wrapper`} className={styles.operatorRowWrapper}>
      <div>
        <OperatorStatusItem
          databaseType={Databases.mysql}
          operator={element.operators.pxc}
          kubernetes={element}
          setSelectedCluster={setSelectedCluster}
          setOperatorToUpdate={setOperatorToUpdate}
          setUpdateOperatorModalVisible={setUpdateOperatorModalVisible}
        />
        <OperatorStatusItem
          databaseType={Databases.mongodb}
          operator={element.operators.psmdb}
          kubernetes={element}
          setSelectedCluster={setSelectedCluster}
          setOperatorToUpdate={setOperatorToUpdate}
          setUpdateOperatorModalVisible={setUpdateOperatorModalVisible}
        />
      </div>
      <AddClusterButton
        label={Messages.dbcluster.addAction}
        action={() => {
          dispatch(selectKubernetesCluster(element));
          history.push(DB_CLUSTER_CREATION_URL);
        }}
        data-testid={`${element.kubernetesClusterName}-add-cluster-button`}
        disabled={isDisabled}
      />
    </div>
  );
};
