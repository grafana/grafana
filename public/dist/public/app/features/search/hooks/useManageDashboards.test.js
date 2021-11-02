import { __awaiter, __generator } from "tslib";
import { renderHook } from '@testing-library/react-hooks';
import * as useSearch from './useSearch';
import { DashboardSearchItemType } from '../types';
import { useManageDashboards } from './useManageDashboards';
import { GENERAL_FOLDER_ID } from '../constants';
describe('useManageDashboards', function () {
    var useSearchMock = jest.spyOn(useSearch, 'useSearch');
    var toggle = function (section) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/, section];
    }); }); };
    function setupTestContext(_a) {
        var _b = _a === void 0 ? {} : _a, _c = _b.results, results = _c === void 0 ? [] : _c;
        jest.clearAllMocks();
        var state = {
            results: results,
            loading: false,
            selectedIndex: 0,
            initialLoading: false,
            allChecked: false,
        };
        var dispatch = null;
        useSearchMock.mockReturnValue({ state: state, dispatch: dispatch, onToggleSection: toggle });
        var dashboardQuery = {};
        var result = renderHook(function () { return useManageDashboards(dashboardQuery, {}); }).result;
        return { result: result };
    }
    describe('when called and only General folder is selected', function () {
        it('then canDelete should be false', function () {
            var results = [
                { id: 1, checked: false, items: [], title: 'One', type: DashboardSearchItemType.DashFolder, toggle: toggle, url: '/' },
                {
                    id: GENERAL_FOLDER_ID,
                    checked: true,
                    items: [],
                    title: 'General',
                    type: DashboardSearchItemType.DashFolder,
                    toggle: toggle,
                    url: '/',
                },
                { id: 2, checked: false, items: [], title: 'Two', type: DashboardSearchItemType.DashFolder, toggle: toggle, url: '/' },
            ];
            var result = setupTestContext({ results: results }).result;
            expect(result.current.canDelete).toBe(false);
        });
    });
    describe('when called and General folder and another folder are selected', function () {
        it('then canDelete should be false', function () {
            var results = [
                {
                    id: 1,
                    checked: true,
                    items: [
                        {
                            id: 11,
                            checked: true,
                            title: 'Eleven',
                            type: DashboardSearchItemType.DashDB,
                            url: '/',
                            isStarred: false,
                            tags: [],
                            uri: '',
                        },
                    ],
                    title: 'One',
                    type: DashboardSearchItemType.DashFolder,
                    toggle: toggle,
                    url: '/',
                },
                {
                    id: GENERAL_FOLDER_ID,
                    checked: true,
                    items: [
                        {
                            id: 10,
                            checked: true,
                            title: 'Ten',
                            type: DashboardSearchItemType.DashDB,
                            url: '/',
                            isStarred: false,
                            tags: [],
                            uri: '',
                        },
                    ],
                    title: 'General',
                    type: DashboardSearchItemType.DashFolder,
                    toggle: toggle,
                    url: '/',
                },
                { id: 2, checked: false, items: [], title: 'Two', type: DashboardSearchItemType.DashFolder, toggle: toggle, url: '/' },
            ];
            var result = setupTestContext({ results: results }).result;
            expect(result.current.canDelete).toBe(false);
        });
    });
    describe('when called on an empty General folder that is not selected but another folder is selected', function () {
        it('then canDelete should be true', function () {
            var results = [
                {
                    id: 1,
                    checked: true,
                    items: [
                        {
                            id: 11,
                            checked: true,
                            title: 'Eleven',
                            type: DashboardSearchItemType.DashDB,
                            url: '/',
                            isStarred: false,
                            tags: [],
                            uri: '',
                        },
                    ],
                    title: 'One',
                    type: DashboardSearchItemType.DashFolder,
                    toggle: toggle,
                    url: '/',
                },
                {
                    id: GENERAL_FOLDER_ID,
                    checked: false,
                    items: [],
                    title: 'General',
                    type: DashboardSearchItemType.DashFolder,
                    toggle: toggle,
                    url: '/',
                },
                { id: 2, checked: false, items: [], title: 'Two', type: DashboardSearchItemType.DashFolder, toggle: toggle, url: '/' },
            ];
            var result = setupTestContext({ results: results }).result;
            expect(result.current.canDelete).toBe(true);
        });
    });
    describe('when called on a non empty General folder that is not selected dashboard in General folder is selected', function () {
        it('then canDelete should be true', function () {
            var results = [
                {
                    id: GENERAL_FOLDER_ID,
                    checked: false,
                    items: [
                        {
                            id: 10,
                            checked: true,
                            title: 'Ten',
                            type: DashboardSearchItemType.DashDB,
                            url: '/',
                            isStarred: false,
                            tags: [],
                            uri: '',
                        },
                    ],
                    title: 'General',
                    type: DashboardSearchItemType.DashFolder,
                    toggle: toggle,
                    url: '/',
                },
            ];
            var result = setupTestContext({ results: results }).result;
            expect(result.current.canDelete).toBe(true);
        });
    });
    describe('when called and no folder is selected', function () {
        it('then canDelete should be false', function () {
            var results = [
                { id: 1, checked: false, items: [], title: 'One', type: DashboardSearchItemType.DashFolder, toggle: toggle, url: '/' },
                {
                    id: GENERAL_FOLDER_ID,
                    checked: false,
                    items: [],
                    title: 'General',
                    type: DashboardSearchItemType.DashFolder,
                    toggle: toggle,
                    url: '/',
                },
                { id: 2, checked: false, items: [], title: 'Two', type: DashboardSearchItemType.DashFolder, toggle: toggle, url: '/' },
            ];
            var result = setupTestContext({ results: results }).result;
            expect(result.current.canDelete).toBe(false);
        });
    });
});
//# sourceMappingURL=useManageDashboards.test.js.map