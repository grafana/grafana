import { config } from '@grafana/runtime';
export function isAngularDatasourcePlugin(dsUid) {
    return Object.entries(config.datasources).some(([_, ds]) => {
        return ds.uid === dsUid && ds.angularDetected;
    });
}
//# sourceMappingURL=utils.js.map