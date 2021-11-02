import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { selectOptionInTest } from '@grafana/ui';
import { SearchResultsFilter } from './SearchResultsFilter';
import { SearchLayout } from '../types';
jest.mock('app/core/services/search_srv');
var noop = jest.fn();
beforeEach(function () {
    jest.clearAllMocks();
});
var searchQuery = {
    starred: false,
    sort: null,
    prevSort: null,
    tag: ['tag'],
    query: '',
    skipRecent: true,
    skipStarred: true,
    folderIds: [],
    layout: SearchLayout.Folders,
};
var setup = function (propOverrides) {
    var props = {
        allChecked: false,
        canDelete: false,
        canMove: false,
        deleteItem: noop,
        moveTo: noop,
        onStarredFilterChange: noop,
        onTagFilterChange: noop,
        onToggleAllChecked: noop,
        onLayoutChange: noop,
        query: searchQuery,
        onSortChange: noop,
        editable: true,
    };
    Object.assign(props, propOverrides);
    render(React.createElement(SearchResultsFilter, __assign({}, props)));
};
describe('SearchResultsFilter', function () {
    it('should render "filter by starred" and "filter by tag" filters by default', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    setup();
                    _a = expect;
                    return [4 /*yield*/, screen.findAllByRole('checkbox')];
                case 1:
                    _a.apply(void 0, [_b.sent()]).toHaveLength(1);
                    expect(screen.queryByText('Move')).not.toBeInTheDocument();
                    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should render Move and Delete buttons when canDelete is true', function () {
        setup({ canDelete: true });
        expect(screen.getAllByRole('checkbox')).toHaveLength(1);
        expect(screen.queryByText('Move')).toBeInTheDocument();
        expect(screen.queryByText('Delete')).toBeInTheDocument();
    });
    it('should render Move and Delete buttons when canMove is true', function () {
        setup({ canMove: true });
        expect(screen.getAllByRole('checkbox')).toHaveLength(1);
        expect(screen.queryByText('Move')).toBeInTheDocument();
        expect(screen.queryByText('Delete')).toBeInTheDocument();
    });
    it('should call onStarredFilterChange when "filter by starred" is changed', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockFilterStarred, checkbox;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockFilterStarred = jest.fn();
                    setup({ onStarredFilterChange: mockFilterStarred });
                    return [4 /*yield*/, screen.findByLabelText(/filter by starred/i)];
                case 1:
                    checkbox = _a.sent();
                    fireEvent.click(checkbox);
                    expect(mockFilterStarred).toHaveBeenCalledTimes(1);
                    return [2 /*return*/];
            }
        });
    }); });
    it('should be called with proper filter option when "filter by tags" is changed', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockFilterByTags, tagComponent;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockFilterByTags = jest.fn();
                    setup({
                        onTagFilterChange: mockFilterByTags,
                        query: __assign(__assign({}, searchQuery), { tag: [] }),
                    });
                    return [4 /*yield*/, screen.findByLabelText('Tag filter')];
                case 1:
                    tagComponent = _a.sent();
                    return [4 /*yield*/, selectOptionInTest(tagComponent, 'tag1')];
                case 2:
                    _a.sent();
                    expect(mockFilterByTags).toHaveBeenCalledTimes(1);
                    expect(mockFilterByTags).toHaveBeenCalledWith(['tag1']);
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=SearchResultsFilter.test.js.map