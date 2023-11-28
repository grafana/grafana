import { __awaiter } from "tslib";
import { lastValueFrom } from 'rxjs';
import { getBackendSrv, getDataSourceSrv } from '@grafana/runtime';
import { PreferencesService } from '../services/PreferencesService';
import { SortOrder } from '../utils/richHistoryTypes';
import { fromDTO } from './remoteStorageConverter';
export default class RichHistoryRemoteStorage {
    constructor() {
        this.preferenceService = new PreferencesService('user');
    }
    addToRichHistory(newRichHistoryQuery) {
        return __awaiter(this, void 0, void 0, function* () {
            const { result } = yield getBackendSrv().post(`/api/query-history`, {
                dataSourceUid: newRichHistoryQuery.datasourceUid,
                queries: newRichHistoryQuery.queries,
            });
            return {
                richHistoryQuery: fromDTO(result),
            };
        });
    }
    deleteAll() {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error('not supported');
        });
    }
    deleteRichHistory(id) {
        return __awaiter(this, void 0, void 0, function* () {
            getBackendSrv().delete(`/api/query-history/${id}`);
        });
    }
    getRichHistory(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            const params = buildQueryParams(filters);
            let requestId = 'query-history-get-all';
            if (filters.starred) {
                requestId = 'query-history-get-starred';
            }
            const queryHistory = yield lastValueFrom(getBackendSrv().fetch({
                method: 'GET',
                url: `/api/query-history?${params}`,
                // to ensure any previous requests are cancelled
                requestId,
            }));
            const data = queryHistory.data;
            const richHistory = (data.result.queryHistory || []).map(fromDTO);
            const total = data.result.totalCount || 0;
            return { richHistory, total };
        });
    }
    getSettings() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const preferences = yield this.preferenceService.load();
            return {
                activeDatasourceOnly: false,
                lastUsedDatasourceFilters: undefined,
                retentionPeriod: 14,
                starredTabAsFirstTab: ((_a = preferences.queryHistory) === null || _a === void 0 ? void 0 : _a.homeTab) === 'starred',
            };
        });
    }
    updateComment(id, comment) {
        return __awaiter(this, void 0, void 0, function* () {
            const dto = yield getBackendSrv().patch(`/api/query-history/${id}`, {
                comment: comment,
            });
            return fromDTO(dto.result);
        });
    }
    updateSettings(settings) {
        return this.preferenceService.patch({
            queryHistory: {
                homeTab: settings.starredTabAsFirstTab ? 'starred' : 'query',
            },
        });
    }
    updateStarred(id, starred) {
        return __awaiter(this, void 0, void 0, function* () {
            let dto;
            if (starred) {
                dto = yield getBackendSrv().post(`/api/query-history/star/${id}`);
            }
            else {
                dto = yield getBackendSrv().delete(`/api/query-history/star/${id}`);
            }
            return fromDTO(dto.result);
        });
    }
}
function buildQueryParams(filters) {
    let params = `${filters.datasourceFilters
        .map((datasourceName) => {
        const uid = getDataSourceSrv().getInstanceSettings(datasourceName).uid;
        return `datasourceUid=${encodeURIComponent(uid)}`;
    })
        .join('&')}`;
    if (filters.search) {
        params = params + `&searchString=${filters.search}`;
    }
    if (filters.sortOrder) {
        params = params + `&sort=${filters.sortOrder === SortOrder.Ascending ? 'time-asc' : 'time-desc'}`;
    }
    if (!filters.starred) {
        const relativeFrom = filters.from === 0 ? 'now' : `now-${filters.from}d`;
        const relativeTo = filters.to === 0 ? 'now' : `now-${filters.to}d`;
        // TODO: Unify: remote storage from/to params are swapped comparing to frontend and local storage filters
        params = params + `&to=${relativeFrom}`;
        params = params + `&from=${relativeTo}`;
    }
    params = params + `&limit=100`;
    params = params + `&page=${filters.page || 1}`;
    if (filters.starred) {
        params = params + `&onlyStarred=${filters.starred}`;
    }
    return params;
}
//# sourceMappingURL=RichHistoryRemoteStorage.js.map