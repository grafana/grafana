export function createDatasourceSettings(jsonData) {
    return {
        id: 0,
        uid: 'x',
        orgId: 0,
        name: 'datasource-test',
        typeLogoUrl: '',
        type: 'datasource',
        typeName: 'Datasource',
        access: 'server',
        url: 'http://localhost',
        password: '',
        user: '',
        database: '',
        basicAuth: false,
        basicAuthPassword: '',
        basicAuthUser: '',
        isDefault: false,
        jsonData: jsonData,
        readOnly: false,
        withCredentials: false,
        secureJsonFields: {},
    };
}
//# sourceMappingURL=mocks.js.map