export var KubernetesClusterStatus;
(function (KubernetesClusterStatus) {
    KubernetesClusterStatus["invalid"] = "KUBERNETES_CLUSTER_STATUS_INVALID";
    KubernetesClusterStatus["ok"] = "KUBERNETES_CLUSTER_STATUS_OK";
    KubernetesClusterStatus["unavailable"] = "KUBERNETES_CLUSTER_STATUS_UNAVAILABLE";
    KubernetesClusterStatus["provisioning"] = "KUBERNETES_CLUSTER_STATUS_PROVISIONING";
})(KubernetesClusterStatus || (KubernetesClusterStatus = {}));
export const KubernetesClusterStatusColors = {
    [KubernetesClusterStatus.ok]: 'green',
    [KubernetesClusterStatus.invalid]: 'red',
    [KubernetesClusterStatus.unavailable]: 'blue',
    [KubernetesClusterStatus.provisioning]: 'orange',
};
//# sourceMappingURL=KubernetesClusterStatus.types.js.map