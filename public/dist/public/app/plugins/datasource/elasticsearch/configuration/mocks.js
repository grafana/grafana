import { createDatasourceSettings } from '../../../../features/datasources/mocks';
export function createDefaultConfigOptions() {
    return createDatasourceSettings({
        timeField: '@time',
        esVersion: '7.0.0',
        interval: 'Hourly',
        timeInterval: '10s',
        maxConcurrentShardRequests: 300,
        logMessageField: 'test.message',
        logLevelField: 'test.level',
    });
}
//# sourceMappingURL=mocks.js.map