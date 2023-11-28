import { __awaiter } from "tslib";
import { take } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { textUtil, urlUtil } from '@grafana/data';
import { CustomScrollbar, useStyles2, IconButton } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { setStarred } from 'app/core/reducers/navBarTree';
import { getBackendSrv } from 'app/core/services/backend_srv';
import impressionSrv from 'app/core/services/impression_srv';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { getVariablesUrlParams } from 'app/features/variables/getAllVariableValuesForUrl';
import { useDispatch } from 'app/types';
import { getStyles } from './styles';
function fetchDashboards(options, replaceVars) {
    return __awaiter(this, void 0, void 0, function* () {
        let starredDashboards = Promise.resolve([]);
        if (options.showStarred) {
            const params = { limit: options.maxItems, starred: 'true' };
            starredDashboards = getBackendSrv().search(params);
        }
        let recentDashboards = Promise.resolve([]);
        let dashUIDs = [];
        if (options.showRecentlyViewed) {
            let uids = yield impressionSrv.getDashboardOpened();
            dashUIDs = take(uids, options.maxItems);
            recentDashboards = getBackendSrv().search({ dashboardUIDs: dashUIDs, limit: options.maxItems });
        }
        let searchedDashboards = Promise.resolve([]);
        if (options.showSearch) {
            const uid = options.folderUID === '' ? 'general' : options.folderUID;
            const params = {
                limit: options.maxItems,
                query: replaceVars(options.query, {}, 'text'),
                folderUIDs: uid,
                tag: options.tags.map((tag) => replaceVars(tag, {}, 'text')),
                type: 'dash-db',
            };
            searchedDashboards = getBackendSrv().search(params);
        }
        const [starred, searched, recent] = yield Promise.all([starredDashboards, searchedDashboards, recentDashboards]);
        // We deliberately deal with recent dashboards first so that the order of dash IDs is preserved
        let dashMap = new Map();
        for (const dashUID of dashUIDs) {
            const dash = recent.find((d) => d.uid === dashUID);
            if (dash) {
                dashMap.set(dashUID, Object.assign(Object.assign({}, dash), { isRecent: true }));
            }
        }
        searched.forEach((dash) => {
            if (!dash.uid) {
                return;
            }
            if (dashMap.has(dash.uid)) {
                dashMap.get(dash.uid).isSearchResult = true;
            }
            else {
                dashMap.set(dash.uid, Object.assign(Object.assign({}, dash), { isSearchResult: true }));
            }
        });
        starred.forEach((dash) => {
            if (!dash.uid) {
                return;
            }
            if (dashMap.has(dash.uid)) {
                dashMap.get(dash.uid).isStarred = true;
            }
            else {
                dashMap.set(dash.uid, Object.assign(Object.assign({}, dash), { isStarred: true }));
            }
        });
        return dashMap;
    });
}
export function DashList(props) {
    const [dashboards, setDashboards] = useState(new Map());
    const dispatch = useDispatch();
    useEffect(() => {
        fetchDashboards(props.options, props.replaceVariables).then((dashes) => {
            setDashboards(dashes);
        });
    }, [props.options, props.replaceVariables, props.renderCounter]);
    const toggleDashboardStar = (e, dash) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { uid, title, url } = dash;
        e.preventDefault();
        e.stopPropagation();
        const isStarred = yield getDashboardSrv().starDashboard(dash.uid, dash.isStarred);
        const updatedDashboards = new Map(dashboards);
        updatedDashboards.set((_a = dash === null || dash === void 0 ? void 0 : dash.uid) !== null && _a !== void 0 ? _a : '', Object.assign(Object.assign({}, dash), { isStarred }));
        setDashboards(updatedDashboards);
        dispatch(setStarred({ id: uid !== null && uid !== void 0 ? uid : '', title, url, isStarred }));
    });
    const [starredDashboards, recentDashboards, searchedDashboards] = useMemo(() => {
        const dashboardList = [...dashboards.values()];
        return [
            dashboardList.filter((dash) => dash.isStarred).sort((a, b) => a.title.localeCompare(b.title)),
            dashboardList.filter((dash) => dash.isRecent),
            dashboardList.filter((dash) => dash.isSearchResult).sort((a, b) => a.title.localeCompare(b.title)),
        ];
    }, [dashboards]);
    const { showStarred, showRecentlyViewed, showHeadings, showSearch } = props.options;
    const dashboardGroups = [
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
    const css = useStyles2(getStyles);
    const renderList = (dashboards) => (React.createElement("ul", null, dashboards.map((dash) => {
        let url = dash.url;
        let params = {};
        if (props.options.keepTime) {
            const range = getTimeSrv().timeRangeForUrl();
            params['from'] = range.from;
            params['to'] = range.to;
        }
        if (props.options.includeVars) {
            params = Object.assign(Object.assign({}, params), getVariablesUrlParams());
        }
        url = urlUtil.appendQueryToUrl(url, urlUtil.toUrlParams(params));
        url = getConfig().disableSanitizeHtml ? url : textUtil.sanitizeUrl(url);
        return (React.createElement("li", { className: css.dashlistItem, key: `dash-${dash.uid}` },
            React.createElement("div", { className: css.dashlistLink },
                React.createElement("div", { className: css.dashlistLinkBody },
                    React.createElement("a", { className: css.dashlistTitle, href: url }, dash.title),
                    dash.folderTitle && React.createElement("div", { className: css.dashlistFolder }, dash.folderTitle)),
                React.createElement(IconButton, { tooltip: dash.isStarred ? `Unmark "${dash.title}" as favorite` : `Mark "${dash.title}" as favorite`, name: dash.isStarred ? 'favorite' : 'star', iconType: dash.isStarred ? 'mono' : 'default', onClick: (e) => toggleDashboardStar(e, dash) }))));
    })));
    return (React.createElement(CustomScrollbar, { autoHeightMin: "100%", autoHeightMax: "100%" }, dashboardGroups.map(({ show, header, dashboards }, i) => show && (React.createElement("div", { className: css.dashlistSection, key: `dash-group-${i}` },
        showHeadings && React.createElement("h6", { className: css.dashlistSectionHeader }, header),
        renderList(dashboards))))));
}
//# sourceMappingURL=DashList.js.map