import { __awaiter } from "tslib";
import { thunkTester } from 'test/core/thunk/thunkTester';
import { dateTime } from '@grafana/data';
import { serializeStateToUrlParam } from '@grafana/data/src/utils/url';
import { locationService } from '@grafana/runtime';
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { MockDataSourceApi } from '../../../../test/mocks/datasource_srv';
import { configureStore } from '../../../store/configureStore';
import { exploreReducer, navigateToExplore, splitClose, splitOpen } from './main';
const getNavigateToExploreContext = (openInNewWindow) => __awaiter(void 0, void 0, void 0, function* () {
    const url = '/explore';
    const panel = {
        datasource: { uid: 'mocked datasource' },
        targets: [{ refId: 'A' }],
    };
    const datasource = new MockDataSourceApi(panel.datasource.uid);
    const get = jest.fn().mockResolvedValue(datasource);
    const getExploreUrl = jest.fn().mockResolvedValue(url);
    const timeRange = { from: dateTime(), to: dateTime() };
    const dispatchedActions = yield thunkTester({})
        .givenThunk(navigateToExplore)
        .whenThunkIsDispatched(panel, { timeRange, getExploreUrl, openInNewWindow });
    return {
        url,
        panel,
        get,
        timeRange,
        getExploreUrl,
        dispatchedActions,
    };
});
describe('navigateToExplore', () => {
    describe('when navigateToExplore thunk is dispatched', () => {
        describe('and openInNewWindow is undefined', () => {
            it('then it should dispatch correct actions', () => __awaiter(void 0, void 0, void 0, function* () {
                const { url } = yield getNavigateToExploreContext();
                expect(locationService.getLocation().pathname).toEqual(url);
            }));
            it('then getExploreUrl should have been called with correct arguments', () => __awaiter(void 0, void 0, void 0, function* () {
                const { getExploreUrl, panel, timeRange } = yield getNavigateToExploreContext();
                expect(getExploreUrl).toHaveBeenCalledTimes(1);
                expect(getExploreUrl).toHaveBeenCalledWith({
                    queries: panel.targets,
                    timeRange,
                    dsRef: panel.datasource,
                });
            }));
        });
        describe('and openInNewWindow is defined', () => {
            const openInNewWindow = jest.fn();
            it('then it should dispatch no actions', () => __awaiter(void 0, void 0, void 0, function* () {
                const { dispatchedActions } = yield getNavigateToExploreContext(openInNewWindow);
                expect(dispatchedActions).toEqual([]);
            }));
            it('then getExploreUrl should have been called with correct arguments', () => __awaiter(void 0, void 0, void 0, function* () {
                const { getExploreUrl, panel, timeRange } = yield getNavigateToExploreContext(openInNewWindow);
                expect(getExploreUrl).toHaveBeenCalledTimes(1);
                expect(getExploreUrl).toHaveBeenCalledWith({
                    queries: panel.targets,
                    timeRange,
                    dsRef: panel.datasource,
                });
            }));
            it('then openInNewWindow should have been called with correct arguments', () => __awaiter(void 0, void 0, void 0, function* () {
                const openInNewWindowFunc = jest.fn();
                const { url } = yield getNavigateToExploreContext(openInNewWindowFunc);
                expect(openInNewWindowFunc).toHaveBeenCalledTimes(1);
                expect(openInNewWindowFunc).toHaveBeenCalledWith(url);
            }));
        });
    });
});
describe('Explore reducer', () => {
    describe('split view', () => {
        describe('split open', () => {
            it('it should create only ony new pane', () => __awaiter(void 0, void 0, void 0, function* () {
                let dispatch, getState;
                const store = configureStore({
                    explore: {
                        panes: {
                            one: { queries: [], range: {} },
                        },
                    },
                });
                dispatch = store.dispatch;
                getState = store.getState;
                yield dispatch(splitOpen());
                let splitPanes = Object.keys(getState().explore.panes);
                expect(splitPanes).toHaveLength(2);
                let secondSplitPaneId = splitPanes[1];
                yield dispatch(splitOpen());
                splitPanes = Object.keys(getState().explore.panes);
                // only 2 panes exist...
                expect(splitPanes).toHaveLength(2);
                // ...and the second pane is replaced
                expect(splitPanes[0]).toBe('one');
                expect(splitPanes[1]).not.toBe(secondSplitPaneId);
            }));
        });
        describe('split close', () => {
            it('should reset right pane when it is closed', () => {
                const leftItemMock = {
                    containerWidth: 100,
                };
                const rightItemMock = {
                    containerWidth: 200,
                };
                const initialState = {
                    panes: {
                        left: leftItemMock,
                        right: rightItemMock,
                    },
                };
                // closing left item
                reducerTester()
                    .givenReducer(exploreReducer, initialState)
                    .whenActionIsDispatched(splitClose('right'))
                    .thenStateShouldEqual({
                    evenSplitPanes: true,
                    largerExploreId: undefined,
                    panes: {
                        left: leftItemMock,
                    },
                    maxedExploreId: undefined,
                    syncedTimes: false,
                });
            });
            it('should unsync time ranges', () => {
                const itemMock = {
                    containerWidth: 100,
                };
                const initialState = {
                    panes: {
                        right: itemMock,
                        left: itemMock,
                    },
                    syncedTimes: true,
                };
                reducerTester()
                    .givenReducer(exploreReducer, initialState)
                    .whenActionIsDispatched(splitClose('right'))
                    .thenStateShouldEqual({
                    evenSplitPanes: true,
                    panes: {
                        left: itemMock,
                    },
                    syncedTimes: false,
                });
            });
        });
    });
});
export const setup = (urlStateOverrides) => {
    const urlStateDefaults = {
        datasource: 'some-datasource',
        queries: [],
        range: {
            from: '',
            to: '',
        },
    };
    const urlState = Object.assign(Object.assign({}, urlStateDefaults), urlStateOverrides);
    const serializedUrlState = serializeStateToUrlParam(urlState);
    const initialState = {
        split: false,
    };
    return {
        initialState,
        serializedUrlState,
    };
};
//# sourceMappingURL=main.test.js.map