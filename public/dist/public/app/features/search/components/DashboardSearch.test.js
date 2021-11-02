import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { render, fireEvent, screen, waitFor, act } from '@testing-library/react';
import { selectOptionInTest } from '@grafana/ui';
import * as SearchSrv from 'app/core/services/search_srv';
import { DashboardSearch } from './DashboardSearch';
import { searchResults } from '../testData';
import { SearchLayout } from '../types';
import { locationService } from '@grafana/runtime';
jest.mock('app/core/services/search_srv');
// Typecast the mock search so the mock import is correctly recognised by TS
// https://stackoverflow.com/a/53222290
var mockSearch = SearchSrv.mockSearch;
beforeEach(function () {
    jest.useFakeTimers('modern');
    mockSearch.mockClear();
});
afterEach(function () {
    jest.useRealTimers();
});
var setup = function (testProps) {
    var props = __assign({ onCloseSearch: function () { } }, testProps);
    render(React.createElement(DashboardSearch, __assign({}, props)));
    jest.runOnlyPendingTimers();
};
/**
 * Need to wrap component render in async act and use jest.runAllTimers to test
 * calls inside useDebounce hook
 */
describe('DashboardSearch', function () {
    it('should call search api with default query when initialised', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    locationService.push('/');
                    setup();
                    return [4 /*yield*/, waitFor(function () { return screen.getByPlaceholderText('Search dashboards by name'); })];
                case 1:
                    _a.sent();
                    expect(mockSearch).toHaveBeenCalledTimes(1);
                    expect(mockSearch).toHaveBeenCalledWith({
                        query: '',
                        tag: [],
                        skipRecent: false,
                        skipStarred: false,
                        starred: false,
                        folderIds: [],
                        layout: SearchLayout.Folders,
                        sort: undefined,
                        prevSort: null,
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    it('should call api with updated query on query change', function () { return __awaiter(void 0, void 0, void 0, function () {
        var input;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    locationService.push('/');
                    setup();
                    return [4 /*yield*/, screen.findByPlaceholderText('Search dashboards by name')];
                case 1:
                    input = _a.sent();
                    return [4 /*yield*/, act((function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, fireEvent.input(input, { target: { value: 'Test' } })];
                                    case 1:
                                        _a.sent();
                                        jest.runOnlyPendingTimers();
                                        return [2 /*return*/];
                                }
                            });
                        }); }))];
                case 2:
                    _a.sent();
                    expect(mockSearch).toHaveBeenCalledWith({
                        query: 'Test',
                        skipRecent: false,
                        skipStarred: false,
                        tag: [],
                        starred: false,
                        folderIds: [],
                        layout: SearchLayout.Folders,
                        sort: undefined,
                        prevSort: null,
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    it("should render 'No results' message when there are no dashboards", function () { return __awaiter(void 0, void 0, void 0, function () {
        var message;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    locationService.push('/');
                    setup();
                    return [4 /*yield*/, screen.findByText('No dashboards matching your query were found.')];
                case 1:
                    message = _a.sent();
                    expect(message).toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should render search results', function () { return __awaiter(void 0, void 0, void 0, function () {
        var section;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockSearch.mockResolvedValueOnce(searchResults);
                    locationService.push('/');
                    setup();
                    return [4 /*yield*/, screen.findAllByLabelText('Search section')];
                case 1:
                    section = _a.sent();
                    expect(section).toHaveLength(2);
                    expect(screen.getAllByLabelText('Search items')).toHaveLength(1);
                    return [2 /*return*/];
            }
        });
    }); });
    it('should call search with selected tags', function () { return __awaiter(void 0, void 0, void 0, function () {
        var tagComponent;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    locationService.push('/');
                    setup();
                    return [4 /*yield*/, waitFor(function () { return screen.getByLabelText('Tag filter'); })];
                case 1:
                    _a.sent();
                    tagComponent = screen.getByLabelText('Tag filter');
                    return [4 /*yield*/, selectOptionInTest(tagComponent, 'tag1')];
                case 2:
                    _a.sent();
                    expect(tagComponent).toBeInTheDocument();
                    return [4 /*yield*/, waitFor(function () {
                            return expect(mockSearch).toHaveBeenCalledWith({
                                query: '',
                                skipRecent: false,
                                skipStarred: false,
                                tag: ['tag1'],
                                starred: false,
                                folderIds: [],
                                layout: SearchLayout.Folders,
                                sort: undefined,
                                prevSort: null,
                            });
                        })];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should call search api with provided search params', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    locationService.partial({ query: 'test query', tag: ['tag1'], sort: 'asc' });
                    setup({});
                    return [4 /*yield*/, waitFor(function () {
                            expect(mockSearch).toHaveBeenCalledTimes(1);
                            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                                query: 'test query',
                                tag: ['tag1'],
                                sort: 'asc',
                            }));
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=DashboardSearch.test.js.map