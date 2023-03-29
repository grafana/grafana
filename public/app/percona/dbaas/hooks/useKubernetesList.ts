import { useEffect } from 'react';

import { useDispatch, useSelector } from 'app/types';

import { useCancelToken } from '../../shared/components/hooks/cancelToken.hook';
import {
  fetchK8sListAction,
  resetK8SClusterListState,
} from '../../shared/core/reducers/dbaas/k8sClusterList/k8sClusterList';
import { getKubernetes as getKubernetesSelector, getPerconaSettingFlag } from '../../shared/core/selectors';
import {
  CHECK_OPERATOR_UPDATE_CANCEL_TOKEN,
  GET_KUBERNETES_CANCEL_TOKEN,
} from '../components/Kubernetes/Kubernetes.constants';
import { Kubernetes } from '../components/Kubernetes/Kubernetes.types';

export const useKubernetesList = (): [Kubernetes[] | undefined, boolean | undefined] => {
  const [generateToken] = useCancelToken();
  const dispatch = useDispatch();
  const { result: kubernetes, loading } = useSelector(getKubernetesSelector);

  useEffect(() => {
    dispatch(
      fetchK8sListAction({
        tokens: {
          kubernetes: generateToken(GET_KUBERNETES_CANCEL_TOKEN),
          operator: generateToken(CHECK_OPERATOR_UPDATE_CANCEL_TOKEN),
        },
      })
    );
    return () => {
      dispatch(resetK8SClusterListState());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [kubernetes, loading];
};

export const useUpdateOfKubernetesList = (): [Kubernetes[] | undefined, boolean | undefined] => {
  const [generateToken] = useCancelToken();
  const dispatch = useDispatch();
  const { result, loading } = useSelector(getKubernetesSelector);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const featureSelector = getPerconaSettingFlag('dbaasEnabled');
  const featureEnabled = useSelector(featureSelector);

  useEffect(() => {
    if (featureEnabled && result === undefined && loading !== true) {
      dispatch(
        fetchK8sListAction({
          tokens: {
            kubernetes: generateToken(GET_KUBERNETES_CANCEL_TOKEN),
            operator: generateToken(CHECK_OPERATOR_UPDATE_CANCEL_TOKEN),
          },
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, loading, featureEnabled]);

  return [result, loading];
};
