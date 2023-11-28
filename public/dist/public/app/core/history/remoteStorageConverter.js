import { getDataSourceSrv } from '@grafana/runtime';
export const fromDTO = (dto) => {
    const datasource = getDataSourceSrv().getInstanceSettings({ uid: dto.datasourceUid });
    return {
        id: dto.uid,
        createdAt: dto.createdAt * 1000,
        datasourceName: (datasource === null || datasource === void 0 ? void 0 : datasource.name) || '',
        datasourceUid: dto.datasourceUid,
        starred: dto.starred,
        comment: dto.comment,
        queries: dto.queries,
    };
};
export const toDTO = (richHistory) => {
    return {
        uid: richHistory.id,
        createdAt: Math.floor(richHistory.createdAt / 1000),
        datasourceUid: richHistory.datasourceUid,
        starred: richHistory.starred,
        comment: richHistory.comment,
        queries: richHistory.queries,
    };
};
//# sourceMappingURL=remoteStorageConverter.js.map