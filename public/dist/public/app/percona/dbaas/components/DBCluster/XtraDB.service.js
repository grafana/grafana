import { omit, pick } from 'lodash';
import { apiManagement } from 'app/percona/shared/helpers/api';
import { SupportedComponents, } from '../Kubernetes/ManageComponentsVersionsModal/ManageComponentsVersionsModal.types';
import { BILLION, THOUSAND } from './DBCluster.constants';
import { DBClusterService } from './DBCluster.service';
import { getComponentChange } from './DBCluster.service.utils';
import { CpuUnits, ResourcesUnits, DBClusterType, DBClusterStatus, } from './DBCluster.types';
import { Operators } from './EditDBClusterPage/DBClusterBasicOptions/DBClusterBasicOptions.types';
export class XtraDBService extends DBClusterService {
    addDBCluster(dbCluster) {
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        return apiManagement.post('/DBaaS/PXCCluster/Create', toAPI(dbCluster));
    }
    updateDBCluster(dbCluster) {
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        return apiManagement.post('/DBaaS/PXCCluster/Update', toAPI(dbCluster));
    }
    resumeDBCluster(dbCluster) {
        return apiManagement.post('/DBaaS/PXCCluster/Update', toResumeAPI(dbCluster));
    }
    suspendDBCluster(dbCluster) {
        return apiManagement.post('/DBaaS/PXCCluster/Update', toSuspendAPI(dbCluster));
    }
    deleteDBClusters(dbCluster) {
        const body = {
            name: dbCluster.clusterName,
            kubernetes_cluster_name: dbCluster.kubernetesClusterName,
            cluster_type: DBClusterType.pxc,
        };
        return apiManagement.post('/DBaaS/DBClusters/Delete', body);
    }
    getDBClusterCredentials(dbCluster) {
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        return apiManagement.post('/DBaaS/PXCClusters/GetCredentials', omit(toAPI(dbCluster), ['params']));
    }
    restartDBCluster(dbCluster) {
        const body = {
            name: dbCluster.clusterName,
            kubernetes_cluster_name: dbCluster.kubernetesClusterName,
            cluster_type: DBClusterType.pxc,
        };
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        return apiManagement.post('/DBaaS/DBClusters/Restart', body);
    }
    getComponents(kubernetesClusterName) {
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        return apiManagement.post('/DBaaS/Components/GetPXC', {
            kubernetes_cluster_name: kubernetesClusterName,
        });
    }
    setComponents(kubernetesClusterName, componentsVersions) {
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        return apiManagement.post('/DBaaS/Components/ChangePXC', {
            kubernetes_cluster_name: kubernetesClusterName,
            pxc: getComponentChange(Operators.pxc, SupportedComponents.pxc, componentsVersions),
            haproxy: getComponentChange(Operators.pxc, SupportedComponents.haproxy, componentsVersions),
        });
    }
    getDatabaseVersions(kubernetesClusterName) {
        return this.getComponents(kubernetesClusterName).then(({ versions }) => {
            /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions */
            return Object.entries(versions[0].matrix.pxc).map(([version, component]) => ({
                value: component.image_path,
                label: version,
                default: !!component.default,
                disabled: !!component.disabled,
            }));
        });
    }
    getExpectedResources(dbCluster) {
        return apiManagement
            .post('/DBaaS/PXCCluster/Resources/Get', pick(toAPI(dbCluster), ['params']))
            .then(({ expected }) => ({
            expected: {
                cpu: { value: expected.cpu_m / THOUSAND, units: CpuUnits.MILLI, original: +expected.cpu_m },
                memory: {
                    value: expected.memory_bytes / BILLION,
                    units: ResourcesUnits.GB,
                    original: +expected.memory_bytes,
                },
                disk: { value: expected.disk_size / BILLION, units: ResourcesUnits.GB, original: +expected.disk_size },
            },
        }));
    }
    getClusterConfiguration(dbCluster) {
        return apiManagement
            .post('/DBaaS/DBClusters/Get', {
            kubernetes_cluster_name: dbCluster.kubernetesClusterName,
            name: dbCluster.clusterName,
        })
            .then((result) => result === null || result === void 0 ? void 0 : result.pxc_cluster);
    }
    toModel(dbCluster, kubernetesClusterName, databaseType) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        return {
            clusterName: dbCluster.name,
            kubernetesClusterName,
            databaseType,
            clusterSize: dbCluster.params.cluster_size,
            memory: (((_b = (_a = dbCluster.params.pxc) === null || _a === void 0 ? void 0 : _a.compute_resources) === null || _b === void 0 ? void 0 : _b.memory_bytes) || 0) / BILLION,
            cpu: (((_d = (_c = dbCluster.params.pxc) === null || _c === void 0 ? void 0 : _c.compute_resources) === null || _d === void 0 ? void 0 : _d.cpu_m) || 0) / THOUSAND,
            disk: (((_e = dbCluster.params.pxc) === null || _e === void 0 ? void 0 : _e.disk_size) || 0) / BILLION,
            status: dbCluster.state || DBClusterStatus.changing,
            message: (_f = dbCluster.operation) === null || _f === void 0 ? void 0 : _f.message,
            finishedSteps: ((_g = dbCluster.operation) === null || _g === void 0 ? void 0 : _g.finished_steps) || 0,
            totalSteps: ((_h = dbCluster.operation) === null || _h === void 0 ? void 0 : _h.total_steps) || 0,
            expose: dbCluster.exposed,
            installedImage: dbCluster.installed_image,
            availableImage: dbCluster.available_image,
            template: dbCluster.template,
            sourceRanges: dbCluster.source_ranges,
        };
    }
}
const toAPI = (dbCluster) => {
    var _a, _b, _c, _d, _e, _f, _g;
    return (Object.assign({ kubernetes_cluster_name: dbCluster.kubernetesClusterName, name: dbCluster.clusterName, expose: dbCluster.expose, internet_facing: dbCluster.internetFacing, source_ranges: dbCluster.sourceRanges, params: Object.assign(Object.assign({ cluster_size: dbCluster.clusterSize, pxc: {
                compute_resources: {
                    cpu_m: dbCluster.cpu * THOUSAND,
                    memory_bytes: dbCluster.memory * BILLION,
                },
                disk_size: dbCluster.disk * BILLION,
                configuration: dbCluster.configuration,
                storage_class: dbCluster.storageClass,
                image: dbCluster.databaseImage,
            }, 
            // Temporary mock data
            haproxy: {
                compute_resources: {
                    cpu_m: THOUSAND / 2,
                    memory_bytes: 0.5 * BILLION,
                },
            } }, (dbCluster.backup && {
            backup: {
                location_id: (_a = dbCluster.backup) === null || _a === void 0 ? void 0 : _a.locationId,
                keep_copies: (_b = dbCluster.backup) === null || _b === void 0 ? void 0 : _b.keepCopies,
                cron_expression: (_c = dbCluster.backup) === null || _c === void 0 ? void 0 : _c.cronExpression,
                service_account: (_d = dbCluster.backup) === null || _d === void 0 ? void 0 : _d.serviceAccount,
            },
        })), (dbCluster.restore && {
            restore: {
                location_id: (_e = dbCluster.restore) === null || _e === void 0 ? void 0 : _e.locationId,
                destination: (_f = dbCluster.restore) === null || _f === void 0 ? void 0 : _f.destination,
                secrets_name: (_g = dbCluster.restore) === null || _g === void 0 ? void 0 : _g.secretsName,
            },
        })) }, (dbCluster.template && {
        template: {
            name: dbCluster.template.name,
            kind: dbCluster.template.kind,
        },
    })));
};
const toSuspendAPI = (dbCluster) => ({
    kubernetes_cluster_name: dbCluster.kubernetesClusterName,
    name: dbCluster.clusterName,
    params: {
        suspend: true,
    },
});
const toResumeAPI = (dbCluster) => ({
    kubernetes_cluster_name: dbCluster.kubernetesClusterName,
    name: dbCluster.clusterName,
    params: {
        resume: true,
    },
});
//# sourceMappingURL=XtraDB.service.js.map