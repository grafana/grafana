import { useState, useEffect } from 'react';
import { AppEvents } from '@grafana/data';
import { logger } from '@percona/platform-core';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { appEvents } from 'app/core/app_events';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { KubernetesService } from './Kubernetes.service';
import {
  Kubernetes,
  KubernetesAPI,
  KubernetesListAPI,
  DeleteKubernetesAction,
  NewKubernetesCluster,
  AddKubernetesAction,
} from './Kubernetes.types';
import { KubernetesClusterStatus } from './KubernetesClusterStatus/KubernetesClusterStatus.types';
import { ADD_KUBERNETES_CANCEL_TOKEN, GET_KUBERNETES_CANCEL_TOKEN } from './Kubernetes.hooks.constants';

export const useKubernetes = (): [Kubernetes[], DeleteKubernetesAction, AddKubernetesAction, boolean] => {
  const [kubernetes, setKubernetes] = useState<Kubernetes[]>([]);
  const [loading, setLoading] = useState(false);
  const [generateToken] = useCancelToken();
  const {
    kubernetes: { deleteSuccess },
  } = Messages;

  const getKubernetes = async () => {
    setLoading(true);

    try {
      const results = (await KubernetesService.getKubernetes(
        generateToken(GET_KUBERNETES_CANCEL_TOKEN)
      )) as KubernetesListAPI;

      setKubernetes(toModelList(results));
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    }
    setLoading(false);
  };

  const deleteKubernetes = async (kubernetesToDelete: Kubernetes, force?: boolean) => {
    try {
      setLoading(true);
      await KubernetesService.deleteKubernetes(kubernetesToDelete, force);
      appEvents.emit(AppEvents.alertSuccess, [deleteSuccess]);
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    } finally {
      getKubernetes();
    }
  };

  const addKubernetes = async (kubernetesToAdd: NewKubernetesCluster) => {
    try {
      setLoading(true);

      await KubernetesService.addKubernetes(kubernetesToAdd, generateToken(ADD_KUBERNETES_CANCEL_TOKEN));
      appEvents.emit(AppEvents.alertSuccess, [Messages.kubernetes.messages.clusterAdded]);
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    } finally {
      getKubernetes();
    }
  };

  useEffect(() => {
    getKubernetes();
  }, []);

  return [kubernetes, deleteKubernetes, addKubernetes, loading];
};

const toModelList = (response: KubernetesListAPI): Kubernetes[] => (response.kubernetes_clusters ?? []).map(toModel);

const toModel = (response: KubernetesAPI): Kubernetes => ({
  kubernetesClusterName: response.kubernetes_cluster_name,
  operators: response.operators,
  status: response.status as KubernetesClusterStatus,
});
