import { __awaiter } from "tslib";
import React from 'react';
import { EventBusSrv, serializeStateToUrlParam } from '@grafana/data';
import { config } from '@grafana/runtime';
import { silenceConsoleOutput } from '../../../../test/core/utils/silenceConsoleOutput';
import { assertDataSourceFilterVisibility, assertLoadMoreQueryHistoryNotVisible, assertQueryHistory, assertQueryHistoryComment, assertQueryHistoryElementsShown, assertQueryHistoryExists, assertQueryHistoryIsEmpty, assertQueryHistoryIsStarred, assertQueryHistoryTabIsSelected, } from './helper/assert';
import { closeQueryHistory, commentQueryHistory, deleteQueryHistory, inputQuery, loadMoreQueryHistory, openQueryHistory, runQuery, selectOnlyActiveDataSource, selectStarredTabFirst, starQueryHistory, switchToQueryHistoryTab, } from './helper/interactions';
import { makeLogsQueryResponse } from './helper/query';
import { setupExplore, tearDown, waitForExplore } from './helper/setup';
const reportInteractionMock = jest.fn();
const testEventBus = new EventBusSrv();
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { reportInteraction: (...args) => {
        reportInteractionMock(...args);
    }, getAppEvents: () => testEventBus })));
jest.mock('app/core/core', () => ({
    contextSrv: {
        hasPermission: () => true,
        isSignedIn: true,
        getValidIntervals: (defaultIntervals) => defaultIntervals,
    },
}));
jest.mock('app/core/services/PreferencesService', () => ({
    PreferencesService: function () {
        return {
            patch: jest.fn(),
            load: jest.fn().mockResolvedValue({
                queryHistory: {
                    homeTab: 'query',
                },
            }),
        };
    },
}));
jest.mock('react-virtualized-auto-sizer', () => {
    return {
        __esModule: true,
        default(props) {
            return React.createElement("div", null, props.children({ width: 1000 }));
        },
    };
});
describe('Explore: Query History', () => {
    const USER_INPUT = 'my query';
    const RAW_QUERY = `{"expr":"${USER_INPUT}"}`;
    silenceConsoleOutput();
    afterEach(() => {
        config.queryHistoryEnabled = false;
        reportInteractionMock.mockClear();
        tearDown();
    });
    it('adds new query history items after the query is run.', () => __awaiter(void 0, void 0, void 0, function* () {
        // when Explore is opened
        const { datasources, unmount } = setupExplore();
        jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse());
        yield waitForExplore();
        // and a user runs a query and opens query history
        yield inputQuery(USER_INPUT);
        yield runQuery();
        yield openQueryHistory();
        // the query that was run is in query history
        yield assertQueryHistoryExists(RAW_QUERY);
        // when Explore is opened again
        unmount();
        tearDown({ clearLocalStorage: false });
        setupExplore({ clearLocalStorage: false });
        yield waitForExplore();
        // previously added query is in query history
        yield openQueryHistory();
        yield assertQueryHistoryExists(RAW_QUERY);
        expect(reportInteractionMock).toBeCalledWith('grafana_explore_query_history_opened', {
            queryHistoryEnabled: false,
        });
    }));
    it('adds recently added query if the query history panel is already open', () => __awaiter(void 0, void 0, void 0, function* () {
        const urlParams = {
            left: serializeStateToUrlParam({
                datasource: 'loki',
                queries: [{ refId: 'A', expr: 'query #1' }],
                range: { from: 'now-1h', to: 'now' },
            }),
        };
        const { datasources } = setupExplore({ urlParams });
        jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse());
        yield waitForExplore();
        yield openQueryHistory();
        yield inputQuery('query #2');
        yield runQuery();
        yield assertQueryHistory(['{"expr":"query #2"}', '{"expr":"query #1"}']);
    }));
    describe('updates the state in both Explore panes', () => {
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            const urlParams = {
                left: serializeStateToUrlParam({
                    datasource: 'loki',
                    queries: [{ refId: 'A', expr: 'query #1' }],
                    range: { from: 'now-1h', to: 'now' },
                }),
                right: serializeStateToUrlParam({
                    datasource: 'loki',
                    queries: [{ refId: 'A', expr: 'query #2' }],
                    range: { from: 'now-1h', to: 'now' },
                }),
            };
            const { datasources } = setupExplore({ urlParams });
            jest.mocked(datasources.loki.query).mockReturnValue(makeLogsQueryResponse());
            yield waitForExplore();
            yield waitForExplore('right');
            yield openQueryHistory('left');
            yield openQueryHistory('right');
        }));
        it('initial state is in sync', () => __awaiter(void 0, void 0, void 0, function* () {
            yield assertQueryHistory(['{"expr":"query #2"}', '{"expr":"query #1"}'], 'left');
            yield assertQueryHistory(['{"expr":"query #2"}', '{"expr":"query #1"}'], 'right');
        }));
        it('starred queries are synced', () => __awaiter(void 0, void 0, void 0, function* () {
            // star one one query
            yield starQueryHistory(1, 'left');
            yield assertQueryHistoryIsStarred([false, true], 'left');
            yield assertQueryHistoryIsStarred([false, true], 'right');
            expect(reportInteractionMock).toBeCalledWith('grafana_explore_query_history_starred', {
                queryHistoryEnabled: false,
                newValue: true,
            });
        }));
        it('deleted queries are synced', () => __awaiter(void 0, void 0, void 0, function* () {
            yield deleteQueryHistory(0, 'left');
            yield assertQueryHistory(['{"expr":"query #1"}'], 'left');
            yield assertQueryHistory(['{"expr":"query #1"}'], 'right');
            expect(reportInteractionMock).toBeCalledWith('grafana_explore_query_history_deleted', {
                queryHistoryEnabled: false,
            });
        }));
    });
    it('add comments to query history', () => __awaiter(void 0, void 0, void 0, function* () {
        const urlParams = {
            left: serializeStateToUrlParam({
                datasource: 'loki',
                queries: [{ refId: 'A', expr: 'query #1' }],
                range: { from: 'now-1h', to: 'now' },
            }),
        };
        const { datasources } = setupExplore({ urlParams });
        jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse());
        yield waitForExplore();
        yield openQueryHistory();
        yield assertQueryHistory(['{"expr":"query #1"}'], 'left');
        yield commentQueryHistory(0, 'test comment');
        yield assertQueryHistoryComment(['test comment'], 'left');
    }));
    it('removes the query item from the history panel when user deletes a regular query', () => __awaiter(void 0, void 0, void 0, function* () {
        const urlParams = {
            left: serializeStateToUrlParam({
                datasource: 'loki',
                queries: [{ refId: 'A', expr: 'query #1' }],
                range: { from: 'now-1h', to: 'now' },
            }),
        };
        const { datasources } = setupExplore({ urlParams });
        jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse());
        yield waitForExplore();
        yield openQueryHistory();
        // queries in history
        yield assertQueryHistory(['{"expr":"query #1"}'], 'left');
        // delete query
        yield deleteQueryHistory(0, 'left');
        // there was only one query in history so assert that query history is empty
        yield assertQueryHistoryIsEmpty('left');
    }));
    it('updates query history settings', () => __awaiter(void 0, void 0, void 0, function* () {
        // open settings page
        setupExplore();
        yield waitForExplore();
        yield openQueryHistory();
        // assert default values
        assertQueryHistoryTabIsSelected('Query history');
        assertDataSourceFilterVisibility(true);
        yield switchToQueryHistoryTab('Settings');
        // change settings
        yield selectStarredTabFirst();
        yield selectOnlyActiveDataSource();
        yield closeQueryHistory();
        yield openQueryHistory();
        // assert new settings
        assertQueryHistoryTabIsSelected('Starred');
        assertDataSourceFilterVisibility(false);
    }));
    it('pagination', () => __awaiter(void 0, void 0, void 0, function* () {
        config.queryHistoryEnabled = true;
        const mockQuery = { refId: 'A', expr: 'query' };
        const { datasources } = setupExplore({
            queryHistory: {
                queryHistory: [{ datasourceUid: 'loki', queries: [mockQuery] }],
                totalCount: 2,
            },
        });
        jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse());
        yield waitForExplore();
        yield openQueryHistory();
        yield assertQueryHistory(['{"expr":"query"}']);
        assertQueryHistoryElementsShown(1, 2);
        yield loadMoreQueryHistory();
        yield assertQueryHistory(['{"expr":"query"}', '{"expr":"query"}']);
        assertLoadMoreQueryHistoryNotVisible();
    }));
});
//# sourceMappingURL=queryHistory.test.js.map