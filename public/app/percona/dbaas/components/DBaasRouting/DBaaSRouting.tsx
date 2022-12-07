import React, { FC, useMemo } from 'react';
import { Redirect } from 'react-router-dom';

import { Spinner, useStyles } from '@grafana/ui/src';

import { useKubernetesList } from '../../hooks/useKubernetesList';
import { DB_CLUSTER_INVENTORY_URL } from '../DBCluster/EditDBClusterPage/EditDBClusterPage.constants';
import { getStyles } from '../DBaasRouting/DBaasRouting.styles';
import { K8S_INVENTORY_URL } from '../Kubernetes/EditK8sClusterPage/EditK8sClusterPage.constants';

export const DBaaSRouting: FC = () => {
  const styles = useStyles(getStyles);
  const [kubernetes, kubernetesLoading] = useKubernetesList();

  const showLoading = useMemo(
    () => (kubernetesLoading && !kubernetes) || kubernetes === undefined,
    [kubernetesLoading, kubernetes]
  );

  return showLoading ? (
    <div data-testid="dbaas-loading" className={styles.spinnerWrapper}>
      <Spinner />
    </div>
  ) : kubernetes && kubernetes.length > 0 ? (
    <Redirect to={DB_CLUSTER_INVENTORY_URL} />
  ) : (
    <Redirect to={K8S_INVENTORY_URL} />
  );
};

export default DBaaSRouting;
