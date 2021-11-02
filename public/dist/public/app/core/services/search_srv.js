import { __assign, __values } from "tslib";
import { clone, keys, sortBy, take, values } from 'lodash';
import impressionSrv from 'app/core/services/impression_srv';
import store from 'app/core/store';
import { contextSrv } from 'app/core/services/context_srv';
import { hasFilters } from 'app/features/search/utils';
import { SECTION_STORAGE_KEY } from 'app/features/search/constants';
import { DashboardSearchItemType, SearchLayout } from 'app/features/search/types';
import { backendSrv } from './backend_srv';
var SearchSrv = /** @class */ (function () {
    function SearchSrv() {
    }
    SearchSrv.prototype.getRecentDashboards = function (sections) {
        return this.queryForRecentDashboards().then(function (result) {
            if (result.length > 0) {
                sections['recent'] = {
                    title: 'Recent',
                    icon: 'clock-nine',
                    score: -1,
                    expanded: store.getBool(SECTION_STORAGE_KEY + ".recent", true),
                    items: result,
                    type: DashboardSearchItemType.DashFolder,
                };
            }
        });
    };
    SearchSrv.prototype.queryForRecentDashboards = function () {
        var dashIds = take(impressionSrv.getDashboardOpened(), 30);
        if (dashIds.length === 0) {
            return Promise.resolve([]);
        }
        return backendSrv.search({ dashboardIds: dashIds }).then(function (result) {
            return dashIds
                .map(function (orderId) { return result.find(function (result) { return result.id === orderId; }); })
                .filter(function (hit) { return hit && !hit.isStarred; });
        });
    };
    SearchSrv.prototype.getStarred = function (sections) {
        if (!contextSrv.isSignedIn) {
            return Promise.resolve();
        }
        return backendSrv.search({ starred: true, limit: 30 }).then(function (result) {
            if (result.length > 0) {
                sections['starred'] = {
                    title: 'Starred',
                    icon: 'star',
                    score: -2,
                    expanded: store.getBool(SECTION_STORAGE_KEY + ".starred", true),
                    items: result,
                    type: DashboardSearchItemType.DashFolder,
                };
            }
        });
    };
    SearchSrv.prototype.search = function (options) {
        var _this = this;
        var _a;
        var sections = {};
        var promises = [];
        var query = clone(options);
        var filters = hasFilters(options) || ((_a = query.folderIds) === null || _a === void 0 ? void 0 : _a.length) > 0;
        query.folderIds = query.folderIds || [];
        if (query.layout === SearchLayout.List) {
            return backendSrv
                .search(__assign(__assign({}, query), { type: DashboardSearchItemType.DashDB }))
                .then(function (results) { return (results.length ? [{ title: '', items: results }] : []); });
        }
        if (!filters) {
            query.folderIds = [0];
        }
        if (!options.skipRecent && !filters) {
            promises.push(this.getRecentDashboards(sections));
        }
        if (!options.skipStarred && !filters) {
            promises.push(this.getStarred(sections));
        }
        promises.push(backendSrv.search(query).then(function (results) {
            return _this.handleSearchResult(sections, results);
        }));
        return Promise.all(promises).then(function () {
            return sortBy(values(sections), 'score');
        });
    };
    SearchSrv.prototype.handleSearchResult = function (sections, results) {
        var e_1, _a, e_2, _b;
        if (results.length === 0) {
            return sections;
        }
        try {
            // create folder index
            for (var results_1 = __values(results), results_1_1 = results_1.next(); !results_1_1.done; results_1_1 = results_1.next()) {
                var hit = results_1_1.value;
                if (hit.type === 'dash-folder') {
                    sections[hit.id] = {
                        id: hit.id,
                        uid: hit.uid,
                        title: hit.title,
                        expanded: false,
                        items: [],
                        url: hit.url,
                        icon: 'folder',
                        score: keys(sections).length,
                        type: hit.type,
                    };
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (results_1_1 && !results_1_1.done && (_a = results_1.return)) _a.call(results_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        try {
            for (var results_2 = __values(results), results_2_1 = results_2.next(); !results_2_1.done; results_2_1 = results_2.next()) {
                var hit = results_2_1.value;
                if (hit.type === 'dash-folder') {
                    continue;
                }
                var section = sections[hit.folderId || 0];
                if (!section) {
                    if (hit.folderId) {
                        section = {
                            id: hit.folderId,
                            uid: hit.folderUid,
                            title: hit.folderTitle,
                            url: hit.folderUrl,
                            items: [],
                            icon: 'folder-open',
                            score: keys(sections).length,
                            type: DashboardSearchItemType.DashFolder,
                        };
                    }
                    else {
                        section = {
                            id: 0,
                            title: 'General',
                            items: [],
                            icon: 'folder-open',
                            score: keys(sections).length,
                            type: DashboardSearchItemType.DashFolder,
                        };
                    }
                    // add section
                    sections[hit.folderId || 0] = section;
                }
                section.expanded = true;
                section.items && section.items.push(hit);
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (results_2_1 && !results_2_1.done && (_b = results_2.return)) _b.call(results_2);
            }
            finally { if (e_2) throw e_2.error; }
        }
    };
    SearchSrv.prototype.getDashboardTags = function () {
        return backendSrv.get('/api/dashboards/tags');
    };
    SearchSrv.prototype.getSortOptions = function () {
        return backendSrv.get('/api/search/sorting');
    };
    return SearchSrv;
}());
export { SearchSrv };
//# sourceMappingURL=search_srv.js.map