import { PluginType } from '@grafana/data';
const buildMockDB = () => ({
    datasets: jest.fn(() => Promise.resolve(['dataset1', 'dataset2'])),
    tables: jest.fn((_ds) => Promise.resolve(['table1', 'table2'])),
    fields: jest.fn((_query, _order) => Promise.resolve([])),
    validateQuery: jest.fn((_query, _range) => Promise.resolve({ query: { refId: '123' }, error: '', isError: false, isValid: true })),
    dsID: jest.fn(() => 1234),
    getEditorLanguageDefinition: jest.fn(() => ({ id: '4567' })),
    toRawSql: (_query) => '',
});
// This data is of type `SqlDatasource`
export const buildMockDatasource = (hasDefaultDatabaseConfigured) => {
    return {
        id: Infinity,
        type: '',
        name: '',
        uid: '',
        responseParser: { transformMetricFindResponse: jest.fn() },
        interval: '',
        db: buildMockDB(),
        preconfiguredDatabase: hasDefaultDatabaseConfigured ? 'default database' : '',
        getDB: () => buildMockDB(),
        getQueryModel: jest.fn(),
        getResponseParser: jest.fn(),
        interpolateVariable: jest.fn(),
        interpolateVariablesInQueries: jest.fn(),
        filterQuery: jest.fn(),
        applyTemplateVariables: jest.fn(),
        metricFindQuery: jest.fn(),
        templateSrv: {
            getVariables: jest.fn(),
            replace: jest.fn(),
            containsTemplate: jest.fn(),
            updateTimeRange: jest.fn(),
        },
        runSql: jest.fn(),
        runMetaQuery: jest.fn(),
        targetContainsTemplate: jest.fn(),
        query: jest.fn(),
        getRequestHeaders: jest.fn(),
        streamOptionsProvider: jest.fn(),
        getResource: jest.fn(),
        postResource: jest.fn(),
        callHealthCheck: jest.fn(),
        testDatasource: jest.fn(),
        getRef: jest.fn(),
        meta: {
            id: '',
            name: '',
            type: PluginType.panel,
            info: {
                author: { name: '' },
                description: '',
                links: [],
                logos: { large: '', small: '' },
                screenshots: [],
                updated: '',
                version: '',
            },
            module: '',
            baseUrl: '',
        },
    };
};
export function buildMockDatasetSelectorProps(overrides) {
    return Object.assign({ db: buildMockDB(), dataset: '', isPostgresInstance: false, onChange: jest.fn(), preconfiguredDataset: '' }, overrides);
}
export function buildMockTableSelectorProps(overrides) {
    return Object.assign({ db: buildMockDB(), dataset: '', table: '', onChange: jest.fn() }, overrides);
}
//# sourceMappingURL=SqlComponents.testHelpers.js.map