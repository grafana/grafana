export var KubernetesOperatorStatus;
(function (KubernetesOperatorStatus) {
    KubernetesOperatorStatus["ok"] = "OPERATORS_STATUS_OK";
    KubernetesOperatorStatus["invalid"] = "OPERATORS_STATUS_INVALID";
    KubernetesOperatorStatus["unsupported"] = "OPERATORS_STATUS_UNSUPPORTED";
    KubernetesOperatorStatus["unavailable"] = "OPERATORS_STATUS_NOT_INSTALLED";
})(KubernetesOperatorStatus || (KubernetesOperatorStatus = {}));
export const KubernetesOperatorStatusColors = {
    [KubernetesOperatorStatus.ok]: 'green',
    [KubernetesOperatorStatus.unsupported]: 'purple',
    [KubernetesOperatorStatus.unavailable]: 'blue',
    [KubernetesOperatorStatus.invalid]: 'red',
};
//# sourceMappingURL=KubernetesOperatorStatus.types.js.map