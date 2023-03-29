import { OPERATOR_COMPONENT_TO_UPDATE_MAP } from '../../../../../dbaas/components/Kubernetes/Kubernetes.constants';
import {
  CheckOperatorUpdateAPI,
  Kubernetes,
  KubernetesAPI,
  KubernetesListAPI,
  Operator,
  OperatorsList,
} from '../../../../../dbaas/components/Kubernetes/Kubernetes.types';
import { KubernetesClusterStatus } from '../../../../../dbaas/components/Kubernetes/KubernetesClusterStatus/KubernetesClusterStatus.types';

export const toKubernetesListModel = (
  response: KubernetesListAPI,
  checkUpdateResponse: CheckOperatorUpdateAPI
): Kubernetes[] => (response.kubernetes_clusters ?? []).map(toKubernetesModel(checkUpdateResponse));

const toKubernetesModel =
  (checkUpdateResponse: CheckOperatorUpdateAPI) =>
  ({ kubernetes_cluster_name: kubernetesClusterName, operators, status }: KubernetesAPI): Kubernetes => ({
    kubernetesClusterName,
    operators: toModelOperators(kubernetesClusterName, operators, checkUpdateResponse),
    status: status as KubernetesClusterStatus,
  });

const toModelOperators = (
  kubernetesClusterName: string,
  operators: OperatorsList,
  { cluster_to_components }: CheckOperatorUpdateAPI
): OperatorsList => {
  const modelOperators = {} as OperatorsList;
  const componentToUpdate = cluster_to_components
    ? cluster_to_components[kubernetesClusterName]?.component_to_update_information
    : undefined;

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
