import { __awaiter } from "tslib";
import { DataFrameView } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { getGrafanaSearcher } from '../service';
import { SearchLayout } from '../types';
import * as utils from '../utils';
import { getSearchStateManager } from './SearchStateManager';
jest.mock('lodash', () => {
    const orig = jest.requireActual('lodash');
    return Object.assign(Object.assign({}, orig), { debounce: (d) => d });
});
jest.mock('@grafana/runtime', () => {
    const originalModule = jest.requireActual('@grafana/runtime');
    return Object.assign({}, originalModule);
});
describe('SearchStateManager', () => {
    const searcher = getGrafanaSearcher();
    jest.spyOn(searcher, 'search').mockResolvedValue({
        isItemLoaded: jest.fn(),
        loadMoreItems: jest.fn(),
        totalRows: 0,
        view: new DataFrameView({ fields: [], length: 0 }),
    });
    it('Can get search state manager with initial state', () => __awaiter(void 0, void 0, void 0, function* () {
        const stm = getSearchStateManager();
        expect(stm.state.layout).toBe(SearchLayout.Folders);
    }));
    describe('initStateFromUrl', () => {
        it('should read and set state from URL and trigger search', () => __awaiter(void 0, void 0, void 0, function* () {
            const stm = getSearchStateManager();
            locationService.partial({ query: 'test', tag: ['tag1', 'tag2'] });
            stm.initStateFromUrl();
            expect(stm.state.folderUid).toBe(undefined);
            expect(stm.state.query).toBe('test');
            expect(stm.state.tag).toEqual(['tag1', 'tag2']);
        }));
        it('should init or clear folderUid', () => __awaiter(void 0, void 0, void 0, function* () {
            const stm = getSearchStateManager();
            stm.initStateFromUrl('asdsadas');
            expect(stm.state.folderUid).toBe('asdsadas');
            stm.initStateFromUrl();
            expect(stm.state.folderUid).toBe(undefined);
        }));
        it('should reset filters if state is updated and no URL params are present', () => {
            const parseRouteParamsSpy = jest.spyOn(utils, 'parseRouteParams');
            // Set initial values
            parseRouteParamsSpy.mockImplementation(() => ({
                query: 'hello',
                sort: 'alpha-asc',
            }));
            const stm = getSearchStateManager();
            stm.initStateFromUrl();
            // Verify that they have been set
            expect(stm.state.query).toBe('hello');
            expect(stm.state.sort).toBe('alpha-asc');
            expect(stm.state.folderUid).toBe(undefined);
            // Changed to a view with no URL state.
            parseRouteParamsSpy.mockImplementation(() => ({}));
            stm.initStateFromUrl('abc');
            expect(stm.state.query).toBe('');
            expect(stm.state.sort).toBe(undefined);
            expect(stm.state.folderUid).toBe('abc');
        });
        it('updates search results in order', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const stm = getSearchStateManager();
            jest.spyOn(searcher, 'search').mockReturnValueOnce(new Promise((resolve) => __awaiter(void 0, void 0, void 0, function* () {
                yield wait(100);
                resolve({
                    isItemLoaded: jest.fn(),
                    loadMoreItems: jest.fn(),
                    totalRows: 100,
                    view: new DataFrameView({ fields: [], length: 0 }),
                });
            })));
            stm.onQueryChange('d');
            jest.spyOn(searcher, 'search').mockReturnValueOnce(new Promise((resolve) => __awaiter(void 0, void 0, void 0, function* () {
                yield wait(50);
                resolve({
                    isItemLoaded: jest.fn(),
                    loadMoreItems: jest.fn(),
                    totalRows: 10,
                    view: new DataFrameView({ fields: [], length: 0 }),
                });
            })));
            stm.onQueryChange('debugging');
            yield wait(150);
            expect((_a = stm.state.result) === null || _a === void 0 ? void 0 : _a.totalRows).toEqual(10);
        }));
    });
});
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
//# sourceMappingURL=SearchStateManager.test.js.map