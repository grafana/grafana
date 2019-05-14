export var getMockDataSources = function (amount) {
    var dataSources = [];
    for (var i = 0; i <= amount; i++) {
        dataSources.push({
            access: '',
            basicAuth: false,
            database: "database-" + i,
            id: i,
            isDefault: false,
            jsonData: { authType: 'credentials', defaultRegion: 'eu-west-2' },
            name: "dataSource-" + i,
            orgId: 1,
            password: '',
            readOnly: false,
            type: 'cloudwatch',
            typeLogoUrl: 'public/app/plugins/datasource/cloudwatch/img/amazon-web-services.png',
            url: '',
            user: '',
        });
    }
    return dataSources;
};
export var getMockDataSource = function () {
    return {
        access: '',
        basicAuth: false,
        basicAuthUser: '',
        basicAuthPassword: '',
        withCredentials: false,
        database: '',
        id: 13,
        isDefault: false,
        jsonData: { authType: 'credentials', defaultRegion: 'eu-west-2' },
        name: 'gdev-cloudwatch',
        orgId: 1,
        password: '',
        readOnly: false,
        type: 'cloudwatch',
        typeLogoUrl: 'public/app/plugins/datasource/cloudwatch/img/amazon-web-services.png',
        url: '',
        user: '',
    };
};
//# sourceMappingURL=dataSourcesMocks.js.map