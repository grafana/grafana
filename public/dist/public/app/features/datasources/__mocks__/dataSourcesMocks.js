import { merge } from 'lodash';
export const getMockDashboard = (override) => (Object.assign({ uid: 'G1btqkgkK', pluginId: 'grafana-timestream-datasource', title: 'Sample (DevOps)', imported: true, importedUri: 'db/sample-devops', importedUrl: '/d/G1btqkgkK/sample-devops', slug: '', dashboardId: 12, folderId: 0, importedRevision: 1, revision: 1, description: '', path: 'dashboards/sample.json', removed: false }, override));
export const getMockDataSources = (amount, overrides) => [...Array(amount)].map((_, i) => getMockDataSource(Object.assign(Object.assign({}, overrides), { id: i, uid: `uid-${i}`, database: (overrides === null || overrides === void 0 ? void 0 : overrides.database) ? `${overrides.database}-${i}` : `database-${i}`, name: (overrides === null || overrides === void 0 ? void 0 : overrides.name) ? `${overrides.name}-${i}` : `dataSource-${i}` })));
export const getMockDataSource = (overrides) => merge({
    access: '',
    basicAuth: false,
    basicAuthUser: '',
    withCredentials: false,
    database: '',
    id: 13,
    uid: 'x',
    isDefault: false,
    jsonData: { authType: 'credentials', defaultRegion: 'eu-west-2' },
    name: 'gdev-cloudwatch',
    typeName: 'Cloudwatch',
    orgId: 1,
    readOnly: false,
    type: 'cloudwatch',
    typeLogoUrl: 'public/app/plugins/datasource/cloudwatch/img/amazon-web-services.png',
    url: '',
    user: '',
    secureJsonFields: {},
}, overrides);
export const getMockDataSourceMeta = (overrides) => merge({
    id: 0,
    name: 'datasource-test',
    type: 'datasource',
    info: {
        author: {
            name: 'Sample Author',
            url: 'https://sample-author.com',
        },
        description: 'Some sample description.',
        links: [{ name: 'Website', url: 'https://sample-author.com' }],
        logos: {
            large: 'large-logo',
            small: 'small-logo',
        },
        screenshots: [],
        updated: '2022-07-01',
        version: '1.5.0',
    },
    module: 'plugins/datasource-test/module',
    baseUrl: 'public/plugins/datasource-test',
}, overrides);
export const getMockDataSourceSettingsState = (overrides) => merge({
    plugin: {
        meta: getMockDataSourceMeta(),
        components: {},
    },
    testingStatus: {},
    loadError: null,
    loading: false,
}, overrides);
//# sourceMappingURL=dataSourcesMocks.js.map