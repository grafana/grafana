import { getDataSourceSrv } from '@grafana/runtime';
export const fromDTO = (dto) => {
    const datasource = getDataSourceSrv().getInstanceSettings(dto.datasourceName);
    return {
        id: dto.ts.toString(),
        createdAt: dto.ts,
        datasourceName: dto.datasourceName,
        datasourceUid: (datasource === null || datasource === void 0 ? void 0 : datasource.uid) || '',
        starred: dto.starred,
        comment: dto.comment,
        queries: dto.queries,
    };
};
export const toDTO = (richHistoryQuery) => {
    const datasource = getDataSourceSrv().getInstanceSettings({ uid: richHistoryQuery.datasourceUid });
    if (!datasource) {
        throw new Error('Datasource not found.');
    }
    return {
        ts: richHistoryQuery.createdAt,
        datasourceName: richHistoryQuery.datasourceName,
        starred: richHistoryQuery.starred,
        comment: richHistoryQuery.comment,
        queries: richHistoryQuery.queries,
    };
};
//# sourceMappingURL=localStorageConverter.js.map