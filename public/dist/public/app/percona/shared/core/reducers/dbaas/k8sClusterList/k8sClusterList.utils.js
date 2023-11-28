/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { OPERATOR_COMPONENT_TO_UPDATE_MAP } from '../../../../../dbaas/components/Kubernetes/Kubernetes.constants';
export const toKubernetesListModel = (response, checkUpdateResponse) => { var _a; return ((_a = response.kubernetes_clusters) !== null && _a !== void 0 ? _a : []).map(toKubernetesModel(checkUpdateResponse)); };
const toKubernetesModel = (checkUpdateResponse) => ({ kubernetes_cluster_name: kubernetesClusterName, operators, status }) => ({
    kubernetesClusterName,
    operators: toModelOperators(kubernetesClusterName, operators, checkUpdateResponse),
    status: status,
});
const toModelOperators = (kubernetesClusterName, operators, { cluster_to_components }) => {
    var _a;
    const modelOperators = {};
    const componentToUpdate = cluster_to_components
        ? (_a = cluster_to_components[kubernetesClusterName]) === null || _a === void 0 ? void 0 : _a.component_to_update_information
        : undefined;
    Object.entries(operators).forEach(([operatorKey, operator]) => {
        const component = OPERATOR_COMPONENT_TO_UPDATE_MAP[operatorKey];
        modelOperators[operatorKey] = Object.assign({ availableVersion: componentToUpdate && componentToUpdate[component] ? componentToUpdate[component].available_version : undefined }, operator);
    });
    return modelOperators;
};
//# sourceMappingURL=k8sClusterList.utils.js.map