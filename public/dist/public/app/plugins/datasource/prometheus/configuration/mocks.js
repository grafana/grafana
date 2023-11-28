import { getMockDataSource } from '../../../../features/datasources/__mocks__';
export function createDefaultConfigOptions() {
    return getMockDataSource({
        jsonData: {
            timeInterval: '1m',
            queryTimeout: '1m',
            httpMethod: 'GET',
            directUrl: 'url',
        },
    });
}
//# sourceMappingURL=mocks.js.map