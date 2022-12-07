import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { useCancelToken } from '../../shared/components/hooks/cancelToken.hook';
import { fetchKubernetesAction } from '../../shared/core/reducers';
import { getKubernetes as getKubernetesSelector } from '../../shared/core/selectors';
import {
  CHECK_OPERATOR_UPDATE_CANCEL_TOKEN,
  GET_KUBERNETES_CANCEL_TOKEN,
} from '../components/Kubernetes/Kubernetes.constants';
import { Kubernetes } from '../components/Kubernetes/Kubernetes.types';

export const useKubernetesList = (): [Kubernetes[] | undefined, boolean] => {
  const [generateToken] = useCancelToken();
  const dispatch = useDispatch();
  const { result: kubernetes, loading } = useSelector(getKubernetesSelector);

  useEffect(() => {
    dispatch(
      fetchKubernetesAction({
        kubernetes: generateToken(GET_KUBERNETES_CANCEL_TOKEN),
        operator: generateToken(CHECK_OPERATOR_UPDATE_CANCEL_TOKEN),
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [kubernetes, loading];
};

export const useUpdateOfKubernetesList = (): [Kubernetes[] | undefined, boolean] => {
  const [generateToken] = useCancelToken();
  const dispatch = useDispatch();
  const { result, loading } = useSelector(getKubernetesSelector);

  useEffect(() => {
    if (result === undefined && loading !== true) {
      dispatch(
        fetchKubernetesAction({
          kubernetes: generateToken(GET_KUBERNETES_CANCEL_TOKEN),
          operator: generateToken(CHECK_OPERATOR_UPDATE_CANCEL_TOKEN),
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, loading]);

  return [result, loading];
};
