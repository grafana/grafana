import { KubernetesClusterStatus } from '../KubernetesClusterStatus/KubernetesClusterStatus.types';
import { KubernetesOperatorStatus } from '../OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';
export const KubernetesService = {
    getKubernetes: () => Promise.resolve({
        kubernetes_clusters: [
            {
                kubernetes_cluster_name: 'cluster_1',
                status: KubernetesClusterStatus.ok,
                operators: { psmdb: { status: KubernetesOperatorStatus.ok }, pxc: { status: KubernetesOperatorStatus.ok } },
            },
            {
                kubernetes_cluster_name: 'cluster_2',
                status: KubernetesClusterStatus.ok,
                operators: { psmdb: { status: KubernetesOperatorStatus.ok }, pxc: { status: KubernetesOperatorStatus.ok } },
            },
        ],
    }),
    checkForOperatorUpdate: () => Promise.resolve({
        cluster_to_components: {
            cluster_1: {
                component_to_update_information: {
                    'psmdb-operator': { available_version: '1' },
                    'pxc-operator': { available_version: '1' },
                },
            },
            cluster_2: {
                component_to_update_information: {
                    'psmdb-operator': { available_version: '1' },
                    'pxc-operator': { available_version: '1' },
                },
            },
        },
    }),
    installOperator: () => Promise.resolve(),
    getDBClusters: () => Promise.resolve(),
};
//# sourceMappingURL=Kubernetes.service.js.map