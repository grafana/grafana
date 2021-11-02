import { __assign, __awaiter, __generator, __read, __spreadArray, __values } from "tslib";
import React, { useEffect, useMemo, useState } from 'react';
import { take } from 'lodash';
import { CustomScrollbar, Icon, useStyles2 } from '@grafana/ui';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import impressionSrv from 'app/core/services/impression_srv';
import { getStyles } from './styles';
function fetchDashboards(options, replaceVars) {
    return __awaiter(this, void 0, void 0, function () {
        var starredDashboards, params, recentDashboards, dashIds, searchedDashboards, params, _a, starred, searched, recent, dashMap, _loop_1, dashIds_1, dashIds_1_1, dashId;
        var e_1, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    starredDashboards = Promise.resolve([]);
                    if (options.showStarred) {
                        params = { limit: options.maxItems, starred: 'true' };
                        starredDashboards = getBackendSrv().search(params);
                    }
                    recentDashboards = Promise.resolve([]);
                    dashIds = [];
                    if (options.showRecentlyViewed) {
                        dashIds = take(impressionSrv.getDashboardOpened(), options.maxItems);
                        recentDashboards = getBackendSrv().search({ dashboardIds: dashIds, limit: options.maxItems });
                    }
                    searchedDashboards = Promise.resolve([]);
                    if (options.showSearch) {
                        params = {
                            limit: options.maxItems,
                            query: replaceVars(options.query, {}, 'text'),
                            folderIds: options.folderId,
                            tag: options.tags.map(function (tag) { return replaceVars(tag, {}, 'text'); }),
                            type: 'dash-db',
                        };
                        searchedDashboards = getBackendSrv().search(params);
                    }
                    return [4 /*yield*/, Promise.all([starredDashboards, searchedDashboards, recentDashboards])];
                case 1:
                    _a = __read.apply(void 0, [_c.sent(), 3]), starred = _a[0], searched = _a[1], recent = _a[2];
                    dashMap = new Map();
                    _loop_1 = function (dashId) {
                        var dash = recent.find(function (d) { return d.id === dashId; });
                        if (dash) {
                            dashMap.set(dashId, __assign(__assign({}, dash), { isRecent: true }));
                        }
                    };
                    try {
                        for (dashIds_1 = __values(dashIds), dashIds_1_1 = dashIds_1.next(); !dashIds_1_1.done; dashIds_1_1 = dashIds_1.next()) {
                            dashId = dashIds_1_1.value;
                            _loop_1(dashId);
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (dashIds_1_1 && !dashIds_1_1.done && (_b = dashIds_1.return)) _b.call(dashIds_1);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                    searched.forEach(function (dash) {
                        if (dashMap.has(dash.id)) {
                            dashMap.get(dash.id).isSearchResult = true;
                        }
                        else {
                            dashMap.set(dash.id, __assign(__assign({}, dash), { isSearchResult: true }));
                        }
                    });
                    starred.forEach(function (dash) {
                        if (dashMap.has(dash.id)) {
                            dashMap.get(dash.id).isStarred = true;
                        }
                        else {
                            dashMap.set(dash.id, __assign(__assign({}, dash), { isStarred: true }));
                        }
                    });
                    return [2 /*return*/, dashMap];
            }
        });
    });
}
export function DashList(props) {
    var _this = this;
    var _a = __read(useState(new Map()), 2), dashboards = _a[0], setDashboards = _a[1];
    useEffect(function () {
        fetchDashboards(props.options, props.replaceVariables).then(function (dashes) {
            setDashboards(dashes);
        });
    }, [props.options, props.replaceVariables, props.renderCounter]);
    var toggleDashboardStar = function (e, dash) { return __awaiter(_this, void 0, void 0, function () {
        var isStarred, updatedDashboards;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    e.stopPropagation();
                    return [4 /*yield*/, getDashboardSrv().starDashboard(dash.id.toString(), dash.isStarred)];
                case 1:
                    isStarred = _a.sent();
                    updatedDashboards = new Map(dashboards);
                    updatedDashboards.set(dash.id, __assign(__assign({}, dash), { isStarred: isStarred }));
                    setDashboards(updatedDashboards);
                    return [2 /*return*/];
            }
        });
    }); };
    var _b = __read(useMemo(function () {
        var dashboardList = __spreadArray([], __read(dashboards.values()), false);
        return [
            dashboardList.filter(function (dash) { return dash.isStarred; }).sort(function (a, b) { return a.title.localeCompare(b.title); }),
            dashboardList.filter(function (dash) { return dash.isRecent; }),
            dashboardList.filter(function (dash) { return dash.isSearchResult; }).sort(function (a, b) { return a.title.localeCompare(b.title); }),
        ];
    }, [dashboards]), 3), starredDashboards = _b[0], recentDashboards = _b[1], searchedDashboards = _b[2];
    var _c = props.options, showStarred = _c.showStarred, showRecentlyViewed = _c.showRecentlyViewed, showHeadings = _c.showHeadings, showSearch = _c.showSearch;
    var dashboardGroups = [
        {
            header: 'Starred dashboards',
            dashboards: starredDashboards,
            show: showStarred,
        },
        {
            header: 'Recently viewed dashboards',
            dashboards: recentDashboards,
            show: showRecentlyViewed,
        },
        {
            header: 'Search',
            dashboards: searchedDashboards,
            show: showSearch,
        },
    ];
    var css = useStyles2(getStyles);
    return (React.createElement(CustomScrollbar, { autoHeightMin: "100%", autoHeightMax: "100%" }, dashboardGroups.map(function (_a, i) {
        var show = _a.show, header = _a.header, dashboards = _a.dashboards;
        return show && (React.createElement("div", { className: css.dashlistSection, key: "dash-group-" + i },
            showHeadings && React.createElement("h6", { className: css.dashlistSectionHeader }, header),
            React.createElement("ul", null, dashboards.map(function (dash) { return (React.createElement("li", { className: css.dashlistItem, key: "dash-" + dash.id },
                React.createElement("div", { className: css.dashlistLink },
                    React.createElement("div", { className: css.dashlistLinkBody },
                        React.createElement("a", { className: css.dashlistTitle, href: dash.url }, dash.title),
                        dash.folderTitle && React.createElement("div", { className: css.dashlistFolder }, dash.folderTitle)),
                    React.createElement("span", { className: css.dashlistStar, onClick: function (e) { return toggleDashboardStar(e, dash); } },
                        React.createElement(Icon, { name: dash.isStarred ? 'favorite' : 'star', type: dash.isStarred ? 'mono' : 'default' }))))); }))));
    })));
}
//# sourceMappingURL=DashList.js.map