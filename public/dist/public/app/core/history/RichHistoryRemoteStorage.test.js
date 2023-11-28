import { __awaiter } from "tslib";
import { of } from 'rxjs';
import { DatasourceSrv } from '../../features/plugins/datasource_srv';
import { SortOrder } from '../utils/richHistoryTypes';
import RichHistoryRemoteStorage from './RichHistoryRemoteStorage';
const dsMock = new DatasourceSrv();
dsMock.init({
    // @ts-ignore
    'name-of-ds1': { uid: 'ds1', name: 'name-of-ds1' },
    // @ts-ignore
    'name-of-ds2': { uid: 'ds2', name: 'name-of-ds2' },
}, '');
const fetchMock = jest.fn();
const postMock = jest.fn();
const deleteMock = jest.fn();
const patchMock = jest.fn();
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => ({
        fetch: fetchMock,
        post: postMock,
        delete: deleteMock,
        patch: patchMock,
    }), getDataSourceSrv: () => dsMock })));
const preferencesServiceMock = {
    patch: jest.fn(),
    load: jest.fn(),
};
jest.mock('../services/PreferencesService', () => ({
    PreferencesService: function () {
        return preferencesServiceMock;
    },
}));
describe('RichHistoryRemoteStorage', () => {
    let storage;
    beforeEach(() => {
        fetchMock.mockReset();
        postMock.mockReset();
        deleteMock.mockReset();
        patchMock.mockReset();
        storage = new RichHistoryRemoteStorage();
    });
    const setup = () => {
        const richHistoryQuery = {
            id: '123',
            createdAt: 200 * 1000,
            datasourceUid: 'ds1',
            datasourceName: 'name-of-ds1',
            starred: true,
            comment: 'comment',
            queries: [{ refId: 'foo' }],
        };
        const richHistoryStarredQuery = Object.assign(Object.assign({}, richHistoryQuery), { starred: false });
        const dto = {
            uid: richHistoryQuery.id,
            createdAt: richHistoryQuery.createdAt / 1000,
            datasourceUid: richHistoryQuery.datasourceUid,
            starred: richHistoryQuery.starred,
            comment: richHistoryQuery.comment,
            queries: richHistoryQuery.queries,
        };
        const dtoStarred = Object.assign(Object.assign({}, dto), { starred: richHistoryStarredQuery.starred });
        return {
            richHistoryQuery,
            richHistoryStarredQuery,
            dto,
            dtoStarred,
        };
    };
    it('returns list of query history items', () => __awaiter(void 0, void 0, void 0, function* () {
        const { richHistoryQuery, dto } = setup();
        const returnedDTOs = [dto];
        fetchMock.mockReturnValue(of({
            data: {
                result: {
                    queryHistory: returnedDTOs,
                    totalCount: returnedDTOs.length,
                },
            },
        }));
        const search = 'foo';
        const datasourceFilters = ['name-of-ds1', 'name-of-ds2'];
        const sortOrder = SortOrder.Descending;
        const starred = false;
        const from = 100;
        const to = 200;
        const expectedLimit = 100;
        const expectedPage = 1;
        const { richHistory, total } = yield storage.getRichHistory({
            search,
            datasourceFilters,
            sortOrder,
            starred,
            to,
            from,
        });
        expect(fetchMock).toBeCalledWith({
            method: 'GET',
            url: `/api/query-history?datasourceUid=ds1&datasourceUid=ds2&searchString=${search}&sort=time-desc&to=now-${from}d&from=now-${to}d&limit=${expectedLimit}&page=${expectedPage}`,
            requestId: 'query-history-get-all',
        });
        expect(richHistory).toMatchObject([richHistoryQuery]);
        expect(total).toBe(1);
    }));
    it('returns list of all starred query history items', () => __awaiter(void 0, void 0, void 0, function* () {
        const { richHistoryStarredQuery, dtoStarred } = setup();
        const returnedDTOs = [dtoStarred];
        fetchMock.mockReturnValue(of({
            data: {
                result: {
                    queryHistory: returnedDTOs,
                    totalCount: returnedDTOs.length,
                },
            },
        }));
        const search = 'foo';
        const datasourceFilters = ['name-of-ds1', 'name-of-ds2'];
        const sortOrder = SortOrder.Descending;
        const starred = true;
        const from = 100;
        const to = 200;
        const expectedLimit = 100;
        const expectedPage = 1;
        const { richHistory, total } = yield storage.getRichHistory({
            search,
            datasourceFilters,
            sortOrder,
            starred,
            from,
            to,
        });
        expect(fetchMock).toBeCalledWith({
            method: 'GET',
            url: `/api/query-history?datasourceUid=ds1&datasourceUid=ds2&searchString=${search}&sort=time-desc&limit=${expectedLimit}&page=${expectedPage}&onlyStarred=${starred}`,
            requestId: 'query-history-get-starred',
        });
        expect(richHistory).toMatchObject([richHistoryStarredQuery]);
        expect(total).toBe(1);
    }));
    it('read starred home tab preferences', () => __awaiter(void 0, void 0, void 0, function* () {
        preferencesServiceMock.load.mockResolvedValue({
            queryHistory: {
                homeTab: 'starred',
            },
        });
        const settings = yield storage.getSettings();
        expect(settings).toMatchObject({
            activeDatasourceOnly: false,
            lastUsedDatasourceFilters: undefined,
            retentionPeriod: 14,
            starredTabAsFirstTab: true,
        });
    }));
    it('uses default home tab preferences', () => __awaiter(void 0, void 0, void 0, function* () {
        preferencesServiceMock.load.mockResolvedValue({
            queryHistory: {
                homeTab: '',
            },
        });
        const settings = yield storage.getSettings();
        expect(settings).toMatchObject({
            activeDatasourceOnly: false,
            lastUsedDatasourceFilters: undefined,
            retentionPeriod: 14,
            starredTabAsFirstTab: false,
        });
    }));
    it('updates user settings', () => __awaiter(void 0, void 0, void 0, function* () {
        yield storage.updateSettings({
            activeDatasourceOnly: false,
            lastUsedDatasourceFilters: undefined,
            retentionPeriod: 14,
            starredTabAsFirstTab: false,
        });
        expect(preferencesServiceMock.patch).toBeCalledWith({
            queryHistory: { homeTab: 'query' },
        });
        yield storage.updateSettings({
            activeDatasourceOnly: false,
            lastUsedDatasourceFilters: undefined,
            retentionPeriod: 14,
            starredTabAsFirstTab: true,
        });
        expect(preferencesServiceMock.patch).toBeCalledWith({
            queryHistory: { homeTab: 'starred' },
        });
    }));
    it('stars query history items', () => __awaiter(void 0, void 0, void 0, function* () {
        const { richHistoryQuery, dto } = setup();
        postMock.mockResolvedValue({
            result: dto,
        });
        const query = yield storage.updateStarred('test', true);
        expect(postMock).toBeCalledWith('/api/query-history/star/test');
        expect(query).toMatchObject(richHistoryQuery);
    }));
    it('unstars query history items', () => __awaiter(void 0, void 0, void 0, function* () {
        const { richHistoryQuery, dto } = setup();
        deleteMock.mockResolvedValue({
            result: dto,
        });
        const query = yield storage.updateStarred('test', false);
        expect(deleteMock).toBeCalledWith('/api/query-history/star/test');
        expect(query).toMatchObject(richHistoryQuery);
    }));
    it('updates query history comments', () => __awaiter(void 0, void 0, void 0, function* () {
        const { richHistoryQuery, dto } = setup();
        patchMock.mockResolvedValue({
            result: dto,
        });
        const query = yield storage.updateComment('test', 'just a comment');
        expect(patchMock).toBeCalledWith('/api/query-history/test', {
            comment: 'just a comment',
        });
        expect(query).toMatchObject(richHistoryQuery);
    }));
    it('deletes query history items', () => __awaiter(void 0, void 0, void 0, function* () {
        yield storage.deleteRichHistory('test');
        expect(deleteMock).toBeCalledWith('/api/query-history/test');
    }));
});
//# sourceMappingURL=RichHistoryRemoteStorage.test.js.map