import { __awaiter } from "tslib";
import store from 'app/core/store';
import { DatasourceSrv } from '../../features/plugins/datasource_srv';
import { backendSrv } from '../services/backend_srv';
import { SortOrder } from '../utils/richHistoryTypes';
import RichHistoryLocalStorage, { MAX_HISTORY_ITEMS } from './RichHistoryLocalStorage';
import { RichHistoryStorageWarning } from './RichHistoryStorage';
const key = 'grafana.explore.richHistory';
const dsMock = new DatasourceSrv();
dsMock.init({
    // @ts-ignore
    'name-of-dev-test': { uid: 'dev-test', name: 'name-of-dev-test' },
    // @ts-ignore
    'name-of-dev-test-2': { uid: 'dev-test-2', name: 'name-of-dev-test-2' },
}, '');
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => backendSrv, getDataSourceSrv: () => dsMock })));
const mockFilters = {
    search: '',
    sortOrder: SortOrder.Descending,
    datasourceFilters: [],
    from: 0,
    to: 7,
    starred: false,
};
const mockItem = {
    id: '2',
    createdAt: 2,
    starred: true,
    datasourceUid: 'dev-test',
    datasourceName: 'name-of-dev-test',
    comment: 'test',
    queries: [{ refId: 'ref', query: 'query-test' }],
};
const mockItem2 = {
    id: '3',
    createdAt: 3,
    starred: true,
    datasourceUid: 'dev-test-2',
    datasourceName: 'name-of-dev-test-2',
    comment: 'test-2',
    queries: [{ refId: 'ref-2', query: 'query-2' }],
};
describe('RichHistoryLocalStorage', () => {
    let storage;
    let now;
    let old;
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        now = new Date(1970, 0, 1);
        old = new Date(1969, 0, 1);
        jest.useFakeTimers();
        jest.setSystemTime(now);
        storage = new RichHistoryLocalStorage();
        yield storage.deleteAll();
    }));
    afterEach(() => {
        jest.useRealTimers();
    });
    describe('basic api', () => {
        it('should save query history to localStorage', () => __awaiter(void 0, void 0, void 0, function* () {
            yield storage.addToRichHistory(mockItem);
            expect(store.exists(key)).toBeTruthy();
            expect((yield storage.getRichHistory(mockFilters)).richHistory).toMatchObject([mockItem]);
        }));
        it('should not save duplicated query to localStorage', () => __awaiter(void 0, void 0, void 0, function* () {
            yield storage.addToRichHistory(mockItem);
            yield storage.addToRichHistory(mockItem2);
            yield expect(() => __awaiter(void 0, void 0, void 0, function* () {
                yield storage.addToRichHistory(mockItem2);
            })).rejects.toThrow('Entry already exists');
            expect((yield storage.getRichHistory(mockFilters)).richHistory).toMatchObject([mockItem2, mockItem]);
        }));
        it('should update starred in localStorage', () => __awaiter(void 0, void 0, void 0, function* () {
            yield storage.addToRichHistory(mockItem);
            yield storage.updateStarred(mockItem.id, false);
            expect((yield storage.getRichHistory(mockFilters)).richHistory[0].starred).toEqual(false);
        }));
        it('should update comment in localStorage', () => __awaiter(void 0, void 0, void 0, function* () {
            yield storage.addToRichHistory(mockItem);
            yield storage.updateComment(mockItem.id, 'new comment');
            expect((yield storage.getRichHistory(mockFilters)).richHistory[0].comment).toEqual('new comment');
        }));
        it('should delete query in localStorage', () => __awaiter(void 0, void 0, void 0, function* () {
            yield storage.addToRichHistory(mockItem);
            yield storage.deleteRichHistory(mockItem.id);
            expect((yield storage.getRichHistory(mockFilters)).richHistory).toEqual([]);
            expect(store.getObject(key)).toEqual([]);
        }));
        it('should save and read settings', () => __awaiter(void 0, void 0, void 0, function* () {
            const settings = {
                retentionPeriod: 2,
                starredTabAsFirstTab: true,
                activeDatasourceOnly: true,
                lastUsedDatasourceFilters: ['foobar'],
            };
            yield storage.updateSettings(settings);
            const storageSettings = storage.getSettings();
            expect(settings).toMatchObject(storageSettings);
        }));
    });
    describe('retention policy and max limits', () => {
        it('should clear old not-starred items', () => __awaiter(void 0, void 0, void 0, function* () {
            const historyStarredOld = {
                starred: true,
                ts: old.getTime(),
                queries: [],
                comment: 'old starred',
                datasourceName: 'name-of-dev-test',
            };
            const historyNotStarredOld = {
                starred: false,
                ts: old.getTime(),
                queries: [],
                comment: 'new not starred',
                datasourceName: 'name-of-dev-test',
            };
            const historyStarredNew = {
                starred: true,
                ts: now.getTime(),
                queries: [],
                comment: 'new starred',
                datasourceName: 'name-of-dev-test',
            };
            const historyNotStarredNew = {
                starred: false,
                ts: now.getTime(),
                queries: [],
                comment: 'new not starred',
                datasourceName: 'name-of-dev-test',
            };
            const history = [historyNotStarredNew, historyStarredNew, historyStarredOld, historyNotStarredOld];
            store.setObject(key, history);
            const historyNew = {
                starred: true,
                datasourceUid: 'dev-test',
                datasourceName: 'name-of-dev-test',
                comment: 'recently added',
                queries: [{ refId: 'ref' }],
            };
            yield storage.addToRichHistory(historyNew);
            const { richHistory } = yield storage.getRichHistory({
                search: '',
                sortOrder: SortOrder.Descending,
                datasourceFilters: [],
                from: 0,
                to: 1000,
                starred: false,
            });
            expect(richHistory).toMatchObject([
                expect.objectContaining({ comment: 'recently added' }),
                expect.objectContaining({ comment: 'new not starred' }),
                expect.objectContaining({ comment: 'new starred' }),
                expect.objectContaining({ comment: 'old starred' }),
            ]);
        }));
        it('should not save more than MAX_HISTORY_ITEMS', () => __awaiter(void 0, void 0, void 0, function* () {
            // For testing we create storage of MAX_HISTORY_ITEMS + extraItems. Half ot these items are starred.
            const extraItems = 100;
            let history = [];
            for (let i = 0; i < MAX_HISTORY_ITEMS + extraItems; i++) {
                history.push({
                    starred: i % 2 === 0,
                    comment: i.toString(),
                    queries: [],
                    ts: Date.now() + 10000, // to bypass retention policy
                });
            }
            const starredItemsInHistory = (MAX_HISTORY_ITEMS + extraItems) / 2;
            const notStarredItemsInHistory = (MAX_HISTORY_ITEMS + extraItems) / 2;
            expect(history.filter((h) => h.starred)).toHaveLength(starredItemsInHistory);
            expect(history.filter((h) => !h.starred)).toHaveLength(notStarredItemsInHistory);
            store.setObject(key, history);
            const { warning } = yield storage.addToRichHistory(mockItem);
            expect(warning).toMatchObject({
                type: RichHistoryStorageWarning.LimitExceeded,
            });
            // one not starred replaced with a newly added starred item
            const removedNotStarredItems = extraItems + 1; // + 1 to make space for the new item
            const newHistory = store.getObject(key);
            expect(newHistory).toHaveLength(MAX_HISTORY_ITEMS); // starred item added
            expect(newHistory.filter((h) => h.starred)).toHaveLength(starredItemsInHistory + 1); // starred item added
            expect(newHistory.filter((h) => !h.starred)).toHaveLength(starredItemsInHistory - removedNotStarredItems);
        }));
    });
    describe('migration', () => {
        afterEach(() => {
            storage.deleteAll();
            expect(store.exists(key)).toBeFalsy();
        });
        describe('should load from localStorage data in old formats', () => {
            it('should load when queries are strings', () => __awaiter(void 0, void 0, void 0, function* () {
                store.setObject(key, [
                    {
                        ts: 2,
                        starred: true,
                        datasourceName: 'name-of-dev-test',
                        comment: 'test',
                        queries: ['test query 1', 'test query 2', 'test query 3'],
                    },
                ]);
                const expectedHistoryItem = {
                    id: '2',
                    createdAt: 2,
                    starred: true,
                    datasourceUid: 'dev-test',
                    datasourceName: 'name-of-dev-test',
                    comment: 'test',
                    queries: [
                        {
                            expr: 'test query 1',
                            refId: 'A',
                        },
                        {
                            expr: 'test query 2',
                            refId: 'B',
                        },
                        {
                            expr: 'test query 3',
                            refId: 'C',
                        },
                    ],
                };
                const { richHistory, total } = yield storage.getRichHistory(mockFilters);
                expect(richHistory).toStrictEqual([expectedHistoryItem]);
                expect(total).toBe(1);
            }));
            it('should load when queries are json-encoded strings', () => __awaiter(void 0, void 0, void 0, function* () {
                store.setObject(key, [
                    {
                        ts: 2,
                        starred: true,
                        datasourceName: 'name-of-dev-test',
                        comment: 'test',
                        queries: ['{"refId":"A","key":"key1","metrics":[]}', '{"refId":"B","key":"key2","metrics":[]}'],
                    },
                ]);
                const expectedHistoryItem = {
                    id: '2',
                    createdAt: 2,
                    starred: true,
                    datasourceUid: 'dev-test',
                    datasourceName: 'name-of-dev-test',
                    comment: 'test',
                    queries: [
                        {
                            refId: 'A',
                            key: 'key1',
                            metrics: [],
                        },
                        {
                            refId: 'B',
                            key: 'key2',
                            metrics: [],
                        },
                    ],
                };
                const { richHistory, total } = yield storage.getRichHistory(mockFilters);
                expect(richHistory).toStrictEqual([expectedHistoryItem]);
                expect(total).toBe(1);
            }));
        });
    });
});
//# sourceMappingURL=RichHistoryLocalStorage.test.js.map