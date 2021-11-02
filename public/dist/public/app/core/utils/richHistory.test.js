import { __assign } from "tslib";
import { addToRichHistory, getRichHistory, updateStarredInRichHistory, updateCommentInRichHistory, mapNumbertoTimeInSlider, createDateStringFromTs, createQueryHeading, deleteAllFromRichHistory, deleteQueryInRichHistory, filterAndSortQueries, SortOrder, MAX_HISTORY_ITEMS, } from './richHistory';
import store from 'app/core/store';
import { dateTime } from '@grafana/data';
var mock = {
    storedHistory: [
        {
            comment: '',
            datasourceId: 'datasource historyId',
            datasourceName: 'datasource history name',
            queries: [
                { expr: 'query1', maxLines: null, refId: '1' },
                { expr: 'query2', refId: '2' },
            ],
            sessionName: '',
            starred: true,
            ts: 1,
        },
    ],
    testComment: '',
    testDatasourceId: 'datasourceId',
    testDatasourceName: 'datasourceName',
    testQueries: [
        { expr: 'query3', refId: 'B' },
        { expr: 'query4', refId: 'C' },
    ],
    testSessionName: '',
    testStarred: false,
};
var key = 'grafana.explore.richHistory';
describe('richHistory', function () {
    beforeEach(function () {
        jest.useFakeTimers('modern');
        jest.setSystemTime(new Date(1970, 0, 1));
    });
    afterEach(function () {
        jest.useRealTimers();
    });
    describe('addToRichHistory', function () {
        beforeEach(function () {
            deleteAllFromRichHistory();
            expect(store.exists(key)).toBeFalsy();
        });
        var expectedResult = [
            {
                comment: mock.testComment,
                datasourceId: mock.testDatasourceId,
                datasourceName: mock.testDatasourceName,
                queries: mock.testQueries,
                sessionName: mock.testSessionName,
                starred: mock.testStarred,
                ts: 2,
            },
            mock.storedHistory[0],
        ];
        it('should append query to query history', function () {
            Date.now = jest.fn(function () { return 2; });
            var newHistory = addToRichHistory(mock.storedHistory, mock.testDatasourceId, mock.testDatasourceName, mock.testQueries, mock.testStarred, mock.testComment, mock.testSessionName, true, true).richHistory;
            expect(newHistory).toEqual(expectedResult);
        });
        it('should save query history to localStorage', function () {
            Date.now = jest.fn(function () { return 2; });
            addToRichHistory(mock.storedHistory, mock.testDatasourceId, mock.testDatasourceName, mock.testQueries, mock.testStarred, mock.testComment, mock.testSessionName, true, true);
            expect(store.exists(key)).toBeTruthy();
            expect(store.getObject(key)).toMatchObject(expectedResult);
        });
        it('should not append duplicated query to query history', function () {
            Date.now = jest.fn(function () { return 2; });
            var newHistory = addToRichHistory(mock.storedHistory, mock.storedHistory[0].datasourceId, mock.storedHistory[0].datasourceName, [{ expr: 'query1', maxLines: null, refId: 'A' }, { expr: 'query2', refId: 'B' }], mock.testStarred, mock.testComment, mock.testSessionName, true, true).richHistory;
            expect(newHistory).toEqual([mock.storedHistory[0]]);
        });
        it('should not save duplicated query to localStorage', function () {
            Date.now = jest.fn(function () { return 2; });
            addToRichHistory(mock.storedHistory, mock.storedHistory[0].datasourceId, mock.storedHistory[0].datasourceName, [{ expr: 'query1', maxLines: null, refId: 'A' }, { expr: 'query2', refId: 'B' }], mock.testStarred, mock.testComment, mock.testSessionName, true, true);
            expect(store.exists(key)).toBeFalsy();
        });
        it('should not save more than MAX_HISTORY_ITEMS', function () {
            Date.now = jest.fn(function () { return 2; });
            var extraItems = 100;
            // the history has more than MAX
            var history = [];
            // history = [ { starred: true, comment: "0" }, { starred: false, comment: "1" }, ... ]
            for (var i = 0; i < MAX_HISTORY_ITEMS + extraItems; i++) {
                history.push({
                    starred: i % 2 === 0,
                    comment: i.toString(),
                    queries: [],
                    ts: new Date(2019, 11, 31).getTime(),
                });
            }
            var starredItemsInHistory = (MAX_HISTORY_ITEMS + extraItems) / 2;
            var notStarredItemsInHistory = (MAX_HISTORY_ITEMS + extraItems) / 2;
            expect(history.filter(function (h) { return h.starred; })).toHaveLength(starredItemsInHistory);
            expect(history.filter(function (h) { return !h.starred; })).toHaveLength(notStarredItemsInHistory);
            var newHistory = addToRichHistory(history, mock.storedHistory[0].datasourceId, mock.storedHistory[0].datasourceName, [{ expr: 'query1', maxLines: null, refId: 'A' }, { expr: 'query2', refId: 'B' }], true, mock.testComment, mock.testSessionName, true, true).richHistory;
            // one not starred replaced with a newly added starred item
            var removedNotStarredItems = extraItems + 1; // + 1 to make space for the new item
            expect(newHistory.filter(function (h) { return h.starred; })).toHaveLength(starredItemsInHistory + 1); // starred item added
            expect(newHistory.filter(function (h) { return !h.starred; })).toHaveLength(starredItemsInHistory - removedNotStarredItems);
        });
    });
    describe('updateStarredInRichHistory', function () {
        it('should update starred in query in history', function () {
            var updatedStarred = updateStarredInRichHistory(mock.storedHistory, 1);
            expect(updatedStarred[0].starred).toEqual(false);
        });
        it('should update starred in localStorage', function () {
            updateStarredInRichHistory(mock.storedHistory, 1);
            expect(store.exists(key)).toBeTruthy();
            expect(store.getObject(key)[0].starred).toEqual(false);
        });
    });
    describe('updateCommentInRichHistory', function () {
        it('should update comment in query in history', function () {
            var updatedComment = updateCommentInRichHistory(mock.storedHistory, 1, 'new comment');
            expect(updatedComment[0].comment).toEqual('new comment');
        });
        it('should update comment in localStorage', function () {
            updateCommentInRichHistory(mock.storedHistory, 1, 'new comment');
            expect(store.exists(key)).toBeTruthy();
            expect(store.getObject(key)[0].comment).toEqual('new comment');
        });
    });
    describe('deleteQueryInRichHistory', function () {
        it('should delete query in query in history', function () {
            var deletedHistory = deleteQueryInRichHistory(mock.storedHistory, 1);
            expect(deletedHistory).toEqual([]);
        });
        it('should delete query in localStorage', function () {
            deleteQueryInRichHistory(mock.storedHistory, 1);
            expect(store.exists(key)).toBeTruthy();
            expect(store.getObject(key)).toEqual([]);
        });
    });
    describe('mapNumbertoTimeInSlider', function () {
        it('should correctly map number to value', function () {
            var value = mapNumbertoTimeInSlider(25);
            expect(value).toEqual('25 days ago');
        });
    });
    describe('createDateStringFromTs', function () {
        it('should correctly create string value from timestamp', function () {
            var value = createDateStringFromTs(1583932327000);
            expect(value).toEqual('March 11');
        });
    });
    describe('filterQueries', function () {
        it('should filter out queries based on data source filter', function () {
            var filteredQueries = filterAndSortQueries(mock.storedHistory, SortOrder.Ascending, ['not provided data source'], '');
            expect(filteredQueries).toHaveLength(0);
        });
        it('should keep queries based on data source filter', function () {
            var filteredQueries = filterAndSortQueries(mock.storedHistory, SortOrder.Ascending, ['datasource history name'], '');
            expect(filteredQueries).toHaveLength(1);
        });
        it('should filter out all queries based on search filter', function () {
            var filteredQueries = filterAndSortQueries(mock.storedHistory, SortOrder.Ascending, [], 'i do not exist in query');
            expect(filteredQueries).toHaveLength(0);
        });
        it('should include queries based on search filter', function () {
            var filteredQueries = filterAndSortQueries(mock.storedHistory, SortOrder.Ascending, [], 'query1');
            expect(filteredQueries).toHaveLength(1);
        });
    });
    describe('createQueryHeading', function () {
        it('should correctly create heading for queries when sort order is ascending ', function () {
            // Have to offset the timezone of a 1 microsecond epoch, and then reverse the changes
            mock.storedHistory[0].ts = 1 + -1 * dateTime().utcOffset() * 60 * 1000;
            var heading = createQueryHeading(mock.storedHistory[0], SortOrder.Ascending);
            expect(heading).toEqual('January 1');
        });
        it('should correctly create heading for queries when sort order is datasourceAZ ', function () {
            var heading = createQueryHeading(mock.storedHistory[0], SortOrder.DatasourceAZ);
            expect(heading).toEqual(mock.storedHistory[0].datasourceName);
        });
    });
    describe('getRichHistory', function () {
        afterEach(function () {
            deleteAllFromRichHistory();
            expect(store.exists(key)).toBeFalsy();
        });
        describe('should load from localStorage data in old formats', function () {
            it('should load when queries are strings', function () {
                var oldHistoryItem = __assign(__assign({}, mock.storedHistory[0]), { queries: ['test query 1', 'test query 2', 'test query 3'] });
                store.setObject(key, [oldHistoryItem]);
                var expectedHistoryItem = __assign(__assign({}, mock.storedHistory[0]), { queries: [
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
                    ] });
                var result = getRichHistory();
                expect(result).toStrictEqual([expectedHistoryItem]);
            });
            it('should load when queries are json-encoded strings', function () {
                var oldHistoryItem = __assign(__assign({}, mock.storedHistory[0]), { queries: ['{"refId":"A","key":"key1","metrics":[]}', '{"refId":"B","key":"key2","metrics":[]}'] });
                store.setObject(key, [oldHistoryItem]);
                var expectedHistoryItem = __assign(__assign({}, mock.storedHistory[0]), { queries: [
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
                    ] });
                var result = getRichHistory();
                expect(result).toStrictEqual([expectedHistoryItem]);
            });
        });
    });
});
//# sourceMappingURL=richHistory.test.js.map