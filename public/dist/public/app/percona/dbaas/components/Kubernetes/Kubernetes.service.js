import { apiManagement } from 'app/percona/shared/helpers/api';
export const KubernetesService = {
    getKubernetes(token) {
        return apiManagement.post('/DBaaS/Kubernetes/List', {}, true, token);
    },
    deleteKubernetes(kubernetes, force, token) {
        return apiManagement.post('/DBaaS/Kubernetes/Unregister', toAPI(kubernetes, force), false, token);
    },
    getKubernetesConfig(kubernetes, token) {
        return apiManagement.post('/DBaaS/Kubernetes/Get', toAPI(kubernetes), false, token);
    },
    getStorageClasses(kubernetesClasterName) {
        return apiManagement.post('/DBaaS/Kubernetes/StorageClasses/List', { kubernetes_cluster_name: kubernetesClasterName }, false);
    },
    addKubernetes(kubernetes, token) {
        return apiManagement.post('/DBaaS/Kubernetes/Register', newClusterToApi(kubernetes), false, token);
    },
    checkForOperatorUpdate(token) {
        return apiManagement.post('/DBaaS/Components/CheckForOperatorUpdate', {}, false, token);
    },
    installOperator(kubernetesClusterName, operatorType, version, token) {
        return apiManagement.post('/DBaaS/Components/InstallOperator', {
            kubernetes_cluster_name: kubernetesClusterName,
            operator_type: operatorType,
            version,
        }, false, token);
    },
    getDBClusters(kubernetes, token) {
        return apiManagement.post('/DBaaS/DBClusters/List', kubernetes, true, token);
    },
};
const toAPI = (kubernetes, force) => ({
    kubernetes_cluster_name: kubernetes.kubernetesClusterName,
    force,
});
const newClusterToApi = ({ name, kubeConfig, isEKS, awsAccessKeyID, awsSecretAccessKey, }) => {
    const cluster = {
        kubernetes_cluster_name: name,
        kube_auth: {
            kubeconfig: kubeConfig,
        },
    };
    if (isEKS) {
        cluster.aws_access_key_id = awsAccessKeyID;
        cluster.aws_secret_access_key = awsSecretAccessKey;
    }
    return cluster;
};
//# sourceMappingURL=Kubernetes.service.js.map