import { __assign, __awaiter, __generator } from "tslib";
import { DashboardSearchItemType } from '../../../search/types';
import { resolveLinks, searchForTags } from './DashboardLinksDashboard';
import { describe, expect } from '../../../../../test/lib/common';
describe('searchForTags', function () {
    var setupTestContext = function () {
        var tags = ['A', 'B'];
        var link = {
            targetBlank: false,
            keepTime: false,
            includeVars: false,
            asDropdown: false,
            icon: 'some icon',
            tags: tags,
            title: 'some title',
            tooltip: 'some tooltip',
            type: 'dashboards',
            url: '/d/6ieouugGk/DashLinks',
        };
        var backendSrv = {
            search: jest.fn(function (args) { return []; }),
        };
        return { link: link, backendSrv: backendSrv };
    };
    describe('when called', function () {
        it('then tags from link should be used in search and limit should be 100', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, link, backendSrv, results;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setupTestContext(), link = _a.link, backendSrv = _a.backendSrv;
                        return [4 /*yield*/, searchForTags(link.tags, { getBackendSrv: function () { return backendSrv; } })];
                    case 1:
                        results = _b.sent();
                        expect(results.length).toEqual(0);
                        expect(backendSrv.search).toHaveBeenCalledWith({ tag: ['A', 'B'], limit: 100 });
                        expect(backendSrv.search).toHaveBeenCalledTimes(1);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
describe('resolveLinks', function () {
    var setupTestContext = function (dashboardId, searchHitId) {
        var link = {
            targetBlank: false,
            keepTime: false,
            includeVars: false,
            asDropdown: false,
            icon: 'some icon',
            tags: [],
            title: 'some title',
            tooltip: 'some tooltip',
            type: 'dashboards',
            url: '/d/6ieouugGk/DashLinks',
        };
        var searchHits = [
            {
                id: searchHitId,
                title: 'DashLinks',
                url: '/d/6ieouugGk/DashLinks',
                isStarred: false,
                items: [],
                tags: [],
                uri: 'db/DashLinks',
                type: DashboardSearchItemType.DashDB,
            },
        ];
        var linkSrv = {
            getLinkUrl: jest.fn(function (args) { return args.url; }),
        };
        var sanitize = jest.fn(function (args) { return args; });
        var sanitizeUrl = jest.fn(function (args) { return args; });
        return { dashboardId: dashboardId, link: link, searchHits: searchHits, linkSrv: linkSrv, sanitize: sanitize, sanitizeUrl: sanitizeUrl };
    };
    describe('when called', function () {
        it('should filter out the calling dashboardId', function () {
            var _a = setupTestContext(1, 1), dashboardId = _a.dashboardId, link = _a.link, searchHits = _a.searchHits, linkSrv = _a.linkSrv, sanitize = _a.sanitize, sanitizeUrl = _a.sanitizeUrl;
            var results = resolveLinks(dashboardId, link, searchHits, { getLinkSrv: function () { return linkSrv; }, sanitize: sanitize, sanitizeUrl: sanitizeUrl });
            expect(results.length).toEqual(0);
            expect(linkSrv.getLinkUrl).toHaveBeenCalledTimes(0);
            expect(sanitize).toHaveBeenCalledTimes(0);
            expect(sanitizeUrl).toHaveBeenCalledTimes(0);
        });
        it('should resolve link url', function () {
            var _a = setupTestContext(1, 2), dashboardId = _a.dashboardId, link = _a.link, searchHits = _a.searchHits, linkSrv = _a.linkSrv, sanitize = _a.sanitize, sanitizeUrl = _a.sanitizeUrl;
            var results = resolveLinks(dashboardId, link, searchHits, { getLinkSrv: function () { return linkSrv; }, sanitize: sanitize, sanitizeUrl: sanitizeUrl });
            expect(results.length).toEqual(1);
            expect(linkSrv.getLinkUrl).toHaveBeenCalledTimes(1);
            expect(linkSrv.getLinkUrl).toHaveBeenCalledWith(__assign(__assign({}, link), { url: searchHits[0].url }));
        });
        it('should sanitize title', function () {
            var _a = setupTestContext(1, 2), dashboardId = _a.dashboardId, link = _a.link, searchHits = _a.searchHits, linkSrv = _a.linkSrv, sanitize = _a.sanitize, sanitizeUrl = _a.sanitizeUrl;
            var results = resolveLinks(dashboardId, link, searchHits, { getLinkSrv: function () { return linkSrv; }, sanitize: sanitize, sanitizeUrl: sanitizeUrl });
            expect(results.length).toEqual(1);
            expect(sanitize).toHaveBeenCalledTimes(1);
            expect(sanitize).toHaveBeenCalledWith(searchHits[0].title);
        });
        it('should sanitize url', function () {
            var _a = setupTestContext(1, 2), dashboardId = _a.dashboardId, link = _a.link, searchHits = _a.searchHits, linkSrv = _a.linkSrv, sanitize = _a.sanitize, sanitizeUrl = _a.sanitizeUrl;
            var results = resolveLinks(dashboardId, link, searchHits, { getLinkSrv: function () { return linkSrv; }, sanitize: sanitize, sanitizeUrl: sanitizeUrl });
            expect(results.length).toEqual(1);
            expect(sanitizeUrl).toHaveBeenCalledTimes(1);
            expect(sanitizeUrl).toHaveBeenCalledWith(searchHits[0].url);
        });
    });
});
//# sourceMappingURL=DashboardLinksDashboard.test.js.map