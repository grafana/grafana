import { __awaiter } from "tslib";
import { apiManagement } from 'app/percona/shared/helpers/api';
import { BILLION, RESOURCES_PRECISION, THOUSAND } from './DBCluster.constants';
import { ResourcesUnits, CpuUnits, } from './DBCluster.types';
import { formatResources } from './DBCluster.utils';
export class DBClusterService {
    static getDBClusters(kubernetes, token) {
        return __awaiter(this, void 0, void 0, function* () {
            return apiManagement.post('/DBaaS/DBClusters/List', kubernetes, true, token);
        });
    }
    static getLogs({ kubernetesClusterName, clusterName }) {
        return __awaiter(this, void 0, void 0, function* () {
            return apiManagement.post('/DBaaS/GetLogs', {
                kubernetes_cluster_name: kubernetesClusterName,
                cluster_name: clusterName,
            }, true);
        });
    }
    static getDBClusterSecrets(kubernetesClusterName) {
        return __awaiter(this, void 0, void 0, function* () {
            return apiManagement.post('/DBaaS/Secrets/List', {
                kubernetes_cluster_name: kubernetesClusterName,
            }, true);
        });
    }
    static getAllocatedResources(kubernetesClusterName) {
        return __awaiter(this, void 0, void 0, function* () {
            return apiManagement
                .post('/DBaaS/Kubernetes/Resources/Get', {
                kubernetes_cluster_name: kubernetesClusterName,
            })
                .then(({ all, available }) => {
                const allocatedCpu = all.cpu_m - available.cpu_m;
                const allocatedMemory = all.memory_bytes - available.memory_bytes;
                const allocatedDisk = all.disk_size - available.disk_size;
                return {
                    total: {
                        cpu: { value: all.cpu_m / THOUSAND, units: CpuUnits.MILLI, original: +all.cpu_m },
                        memory: { value: all.memory_bytes / BILLION, units: ResourcesUnits.GB, original: +all.memory_bytes },
                        disk: formatResources(+all.disk_size, RESOURCES_PRECISION),
                    },
                    allocated: {
                        cpu: { value: allocatedCpu / THOUSAND, units: CpuUnits.MILLI, original: allocatedCpu },
                        memory: {
                            value: allocatedMemory / BILLION,
                            units: ResourcesUnits.GB,
                            original: allocatedMemory,
                        },
                        disk: { value: allocatedDisk / BILLION, units: ResourcesUnits.GB, original: allocatedDisk },
                    },
                };
            });
        });
    }
    static getDBClusterTemplates(kubernetesClusterName, k8sClusterType) {
        return __awaiter(this, void 0, void 0, function* () {
            return apiManagement.post('/DBaaS/Templates/List', { kubernetes_cluster_name: kubernetesClusterName, cluster_type: k8sClusterType }, true);
        });
    }
}
//# sourceMappingURL=DBCluster.service.js.map