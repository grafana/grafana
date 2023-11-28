import { KubernetesClusterStatus } from '../KubernetesClusterStatus/KubernetesClusterStatus.types';
import { KubernetesOperatorStatus } from '../OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';
export const kubernetesStub = [
    {
        kubernetesClusterName: 'Cluster 1',
        operators: {
            psmdb: {
                status: KubernetesOperatorStatus.ok,
            },
            pxc: {
                status: KubernetesOperatorStatus.ok,
            },
        },
        status: KubernetesClusterStatus.ok,
    },
    {
        kubernetesClusterName: 'Cluster 2',
        operators: {
            psmdb: {
                status: KubernetesOperatorStatus.ok,
            },
            pxc: {
                status: KubernetesOperatorStatus.ok,
            },
        },
        status: KubernetesClusterStatus.ok,
    },
];
export const deleteActionStub = jest.fn();
export const addActionStub = jest.fn(() => {
    kubernetesStub.push({
        kubernetesClusterName: 'test',
        operators: {
            psmdb: {
                status: KubernetesOperatorStatus.ok,
            },
            pxc: {
                status: KubernetesOperatorStatus.ok,
            },
        },
        status: KubernetesClusterStatus.ok,
    });
});
export const getActionStub = jest.fn(() => kubernetesStub);
export const setLoadingActionStub = jest.fn();
//# sourceMappingURL=kubernetesStubs.js.map