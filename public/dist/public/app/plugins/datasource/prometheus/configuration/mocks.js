import { createDatasourceSettings } from '../../../../features/datasources/mocks';
export function createDefaultConfigOptions() {
    return createDatasourceSettings({
        timeInterval: '1m',
        queryTimeout: '1m',
        httpMethod: 'GET',
        directUrl: 'url',
    });
}
//# sourceMappingURL=mocks.js.map