import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { AppEvents } from '@grafana/data';
import { logger } from '@percona/platform-core';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { getPerconaSettings } from 'app/percona/shared/core/selectors';
import { appEvents } from 'app/core/app_events';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';
import { KubernetesService } from './Kubernetes.service';
import {
  Kubernetes,
  KubernetesAPI,
  KubernetesListAPI,
  NewKubernetesCluster,
  CheckOperatorUpdateAPI,
  OperatorsList,
  Operator,
  ManageKubernetes,
} from './Kubernetes.types';
import { KubernetesClusterStatus } from './KubernetesClusterStatus/KubernetesClusterStatus.types';
import {
  ADD_KUBERNETES_CANCEL_TOKEN,
  CHECK_OPERATOR_UPDATE_CANCEL_TOKEN,
  GET_KUBERNETES_CANCEL_TOKEN,
} from './Kubernetes.hooks.constants';
import { OPERATOR_COMPONENT_TO_UPDATE_MAP } from './Kubernetes.constants';

export const useKubernetes = (): ManageKubernetes => {
  const [kubernetes, setKubernetes] = useState<Kubernetes[]>([]);
  const [loading, setLoading] = useState(false);
  const { dbaasEnabled } = useSelector(getPerconaSettings);
  const [generateToken] = useCancelToken();
  const {
    kubernetes: { deleteSuccess },
  } = Messages;

  const getKubernetes = async () => {
    setLoading(true);

    try {
      const [results, checkUpdateResults] = await Promise.all([
        KubernetesService.getKubernetes(generateToken(GET_KUBERNETES_CANCEL_TOKEN)),
        KubernetesService.checkForOperatorUpdate(generateToken(CHECK_OPERATOR_UPDATE_CANCEL_TOKEN)),
      ]);

      setKubernetes(toModelList(results, checkUpdateResults));
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (dbaasEnabled) {
      getKubernetes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbaasEnabled]);

  return [kubernetes, deleteKubernetes, addKubernetes, getKubernetes, setLoading, loading];
};

const toModelList = (response: KubernetesListAPI, checkUpdateResponse: CheckOperatorUpdateAPI): Kubernetes[] =>
  (response.kubernetes_clusters ?? []).map(toModel(checkUpdateResponse));

const toModel = (checkUpdateResponse: CheckOperatorUpdateAPI) => ({
  kubernetes_cluster_name: kubernetesClusterName,
  operators,
  status,
}: KubernetesAPI): Kubernetes => ({
  kubernetesClusterName,
  operators: toModelOperators(kubernetesClusterName, operators, checkUpdateResponse),
  status: status as KubernetesClusterStatus,
});

// adds avaiableVersion to operators dynamically
const toModelOperators = (
  kubernetesClusterName: string,
  operators: OperatorsList,
  { cluster_to_components }: CheckOperatorUpdateAPI
): OperatorsList => {
  const modelOperators = {} as OperatorsList;
  const componentToUpdate = cluster_to_components[kubernetesClusterName].component_to_update_information;

  Object.entries(operators).forEach(([operatorKey, operator]: [string, Operator]) => {
    const component = OPERATOR_COMPONENT_TO_UPDATE_MAP[operatorKey as keyof OperatorsList];

    modelOperators[operatorKey as keyof OperatorsList] = {
      availableVersion:
        componentToUpdate && componentToUpdate[component] ? componentToUpdate[component].available_version : undefined,
      ...operator,
    };
  });

  return modelOperators;
};
