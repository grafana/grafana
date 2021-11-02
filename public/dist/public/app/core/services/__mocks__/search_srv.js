import { __awaiter, __generator } from "tslib";
export var mockSearch = jest.fn(function () {
    return Promise.resolve([]);
});
export var mockGetDashboardTags = jest.fn(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, Promise.resolve([
                { term: 'tag1', count: 2 },
                { term: 'tag2', count: 10 },
            ])];
    });
}); });
export var mockGetSortOptions = jest.fn(function () {
    return Promise.resolve({ sortOptions: [{ name: 'test', displayName: 'Test' }] });
});
export var SearchSrv = jest.fn().mockImplementation(function () {
    return {
        search: mockSearch,
        getDashboardTags: mockGetDashboardTags,
        getSortOptions: mockGetSortOptions,
    };
});
//# sourceMappingURL=search_srv.js.map