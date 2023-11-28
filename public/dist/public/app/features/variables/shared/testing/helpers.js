export function getDataSourceInstanceSetting(name, meta) {
    return {
        id: 1,
        uid: name,
        type: '',
        name,
        meta,
        access: 'proxy',
        jsonData: {},
        readOnly: false,
    };
}
//# sourceMappingURL=helpers.js.map