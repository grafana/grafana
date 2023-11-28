import { __awaiter } from "tslib";
import { backendSrv } from 'app/core/services/__mocks__/backend_srv';
import { DashboardSearchItemType } from '../../../search/types';
import { resolveLinks, searchForTags } from './DashboardLinksDashboard';
describe('searchForTags', () => {
    const setupTestContext = () => {
        const tags = ['A', 'B'];
        const link = {
            targetBlank: false,
            keepTime: false,
            includeVars: false,
            asDropdown: false,
            icon: 'some icon',
            tags,
            title: 'some title',
            tooltip: 'some tooltip',
            type: 'dashboards',
            url: '/d/6ieouugGk/DashLinks',
        };
        jest.spyOn(backendSrv, 'search').mockResolvedValue([]);
        return { link, backendSrv };
    };
    describe('when called', () => {
        it('then tags from link should be used in search and limit should be 100', () => __awaiter(void 0, void 0, void 0, function* () {
            const { link, backendSrv } = setupTestContext();
            const results = yield searchForTags(link.tags, { getBackendSrv: () => backendSrv });
            expect(results.length).toEqual(0);
            expect(backendSrv.search).toHaveBeenCalledWith({ tag: ['A', 'B'], limit: 100 });
            expect(backendSrv.search).toHaveBeenCalledTimes(1);
        }));
    });
});
describe('resolveLinks', () => {
    const setupTestContext = (dashboardUID, searchHitId) => {
        const link = {
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
        const searchHits = [
            {
                uid: searchHitId,
                title: 'DashLinks',
                url: '/d/6ieouugGk/DashLinks',
                isStarred: false,
                tags: [],
                uri: 'db/DashLinks',
                type: DashboardSearchItemType.DashDB,
            },
        ];
        const linkSrv = {
            getLinkUrl: jest.fn((args) => args.url),
        };
        const sanitize = jest.fn((args) => args);
        const sanitizeUrl = jest.fn((args) => args);
        return { dashboardUID, link, searchHits, linkSrv, sanitize, sanitizeUrl };
    };
    describe('when called', () => {
        it('should filter out the calling dashboardUID', () => {
            const { dashboardUID, link, searchHits, linkSrv, sanitize, sanitizeUrl } = setupTestContext('1', '1');
            const results = resolveLinks(dashboardUID, link, searchHits, {
                getLinkSrv: () => linkSrv,
                sanitize,
                sanitizeUrl,
            });
            expect(results.length).toEqual(0);
            expect(linkSrv.getLinkUrl).toHaveBeenCalledTimes(0);
            expect(sanitize).toHaveBeenCalledTimes(0);
            expect(sanitizeUrl).toHaveBeenCalledTimes(0);
        });
        it('should resolve link url', () => {
            const { dashboardUID, link, searchHits, linkSrv, sanitize, sanitizeUrl } = setupTestContext('1', '2');
            const results = resolveLinks(dashboardUID, link, searchHits, {
                getLinkSrv: () => linkSrv,
                sanitize,
                sanitizeUrl,
            });
            expect(results.length).toEqual(1);
            expect(linkSrv.getLinkUrl).toHaveBeenCalledTimes(1);
            expect(linkSrv.getLinkUrl).toHaveBeenCalledWith(Object.assign(Object.assign({}, link), { url: searchHits[0].url }));
        });
        it('should sanitize title', () => {
            const { dashboardUID, link, searchHits, linkSrv, sanitize, sanitizeUrl } = setupTestContext('1', '2');
            const results = resolveLinks(dashboardUID, link, searchHits, {
                getLinkSrv: () => linkSrv,
                sanitize,
                sanitizeUrl,
            });
            expect(results.length).toEqual(1);
            expect(sanitize).toHaveBeenCalledTimes(1);
            expect(sanitize).toHaveBeenCalledWith(searchHits[0].title);
        });
        it('should sanitize url', () => {
            const { dashboardUID, link, searchHits, linkSrv, sanitize, sanitizeUrl } = setupTestContext('1', '2');
            const results = resolveLinks(dashboardUID, link, searchHits, {
                getLinkSrv: () => linkSrv,
                sanitize,
                sanitizeUrl,
            });
            expect(results.length).toEqual(1);
            expect(sanitizeUrl).toHaveBeenCalledTimes(1);
            expect(sanitizeUrl).toHaveBeenCalledWith(searchHits[0].url);
        });
    });
});
//# sourceMappingURL=DashboardLinksDashboard.test.js.map