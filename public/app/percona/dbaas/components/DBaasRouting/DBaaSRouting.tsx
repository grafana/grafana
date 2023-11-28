import React, { FC, useCallback, useMemo } from 'react';
import { Redirect } from 'react-router-dom';

import { Spinner, useStyles } from '@grafana/ui/src';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';

import { getPerconaSettingFlag } from '../../../shared/core/selectors';
import { Messages } from '../../DBaaS.messages';
import { useKubernetesList } from '../../hooks/useKubernetesList';
import { DB_CLUSTER_INVENTORY_URL } from '../DBCluster/EditDBClusterPage/EditDBClusterPage.constants';
import { K8S_INVENTORY_URL } from '../Kubernetes/EditK8sClusterPage/EditK8sClusterPage.constants';

import { getStyles } from './DBaasRouting.styles';

export const DBaaSRouting: FC<React.PropsWithChildren<unknown>> = () => {
  const styles = useStyles(getStyles);
  const [kubernetes, kubernetesLoading] = useKubernetesList();

  const showLoading = useMemo(
    () => (kubernetesLoading && !kubernetes) || kubernetes === undefined,
    [kubernetesLoading, kubernetes]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const featureSelector = useCallback(getPerconaSettingFlag('dbaasEnabled'), []);

  return (
    <FeatureLoader featureName={Messages.dbaas} featureSelector={featureSelector}>
      {showLoading ? (
        <div data-testid="dbaas-loading" className={styles.spinnerWrapper}>
          <Spinner />
        </div>
      ) : kubernetes && kubernetes.length > 0 ? (
        <Redirect to={DB_CLUSTER_INVENTORY_URL} />
      ) : (
        <Redirect to={K8S_INVENTORY_URL} />
      )}
    </FeatureLoader>
  );
};

export default DBaaSRouting;
