import { getMockDataSource } from 'app/features/datasources/__mocks__';
export function createDefaultConfigOptions(options) {
    return getMockDataSource({
        jsonData: Object.assign({ timeField: '@time', interval: 'Hourly', timeInterval: '10s', maxConcurrentShardRequests: 300, logMessageField: 'test.message', logLevelField: 'test.level' }, options),
    });
}
//# sourceMappingURL=mocks.js.map