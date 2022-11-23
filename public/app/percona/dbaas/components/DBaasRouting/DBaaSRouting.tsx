import React, { FC, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Redirect } from 'react-router-dom';

import { Spinner, useStyles } from '@grafana/ui/src';

import { useCancelToken } from '../../../shared/components/hooks/cancelToken.hook';
import { fetchKubernetesAction } from '../../../shared/core/reducers';
import { getKubernetes as getKubernetesSelector } from '../../../shared/core/selectors';
import { getStyles } from '../DBaasRouting/DBaasRouting.styles';
import { CHECK_OPERATOR_UPDATE_CANCEL_TOKEN, GET_KUBERNETES_CANCEL_TOKEN } from '../Kubernetes/Kubernetes.constants';

export const DBaaSRouting: FC = () => {
  const styles = useStyles(getStyles);
  const { result: kubernetes, loading: kubernetesLoading } = useSelector(getKubernetesSelector);
  const [generateToken] = useCancelToken();
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(
      fetchKubernetesAction({
        kubernetes: generateToken(GET_KUBERNETES_CANCEL_TOKEN),
        operator: generateToken(CHECK_OPERATOR_UPDATE_CANCEL_TOKEN),
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showLoading = useMemo(() => kubernetesLoading && !kubernetes, [kubernetesLoading, kubernetes]);

  return showLoading ? (
    <div data-testid="dbaas-loading" className={styles.spinnerWrapper}>
      <Spinner />
    </div>
  ) : kubernetes && kubernetes.length > 0 ? (
    <Redirect to="/dbaas/dbclusters" />
  ) : (
    <Redirect to="/dbaas/kubernetes" />
  );
};

export default DBaaSRouting;
