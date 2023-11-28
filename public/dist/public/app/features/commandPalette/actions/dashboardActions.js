import { __awaiter } from "tslib";
import debounce from 'debounce-promise';
import { useEffect, useRef, useState } from 'react';
import { config } from '@grafana/runtime';
import { t } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';
import impressionSrv from 'app/core/services/impression_srv';
import { getGrafanaSearcher } from 'app/features/search/service';
import { RECENT_DASHBOARDS_PRORITY, SEARCH_RESULTS_PRORITY } from '../values';
const MAX_SEARCH_RESULTS = 100;
const MAX_RECENT_DASHBOARDS = 5;
const debouncedSearch = debounce(getSearchResultActions, 200);
export function getRecentDashboardActions() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!contextSrv.user.isSignedIn) {
            return [];
        }
        const recentUids = (yield impressionSrv.getDashboardOpened()).slice(0, MAX_RECENT_DASHBOARDS);
        const resultsDataFrame = yield getGrafanaSearcher().search({
            kind: ['dashboard'],
            limit: MAX_RECENT_DASHBOARDS,
            uid: recentUids,
        });
        // Search results are alphabetical, so reorder them according to recently viewed
        const recentResults = resultsDataFrame.view.toArray();
        recentResults.sort((resultA, resultB) => {
            const orderA = recentUids.indexOf(resultA.uid);
            const orderB = recentUids.indexOf(resultB.uid);
            return orderA - orderB;
        });
        const recentDashboardActions = recentResults.map((item) => {
            const { url, name } = item; // items are backed by DataFrameView, so must hold the url in a closure
            return {
                id: `recent-dashboards${url}`,
                name: `${name}`,
                section: t('command-palette.section.recent-dashboards', 'Recent dashboards'),
                priority: RECENT_DASHBOARDS_PRORITY,
                url,
            };
        });
        return recentDashboardActions;
    });
}
export function getSearchResultActions(searchQuery) {
    return __awaiter(this, void 0, void 0, function* () {
        // Empty strings should not come through to here
        if (searchQuery.length === 0 || (!contextSrv.user.isSignedIn && !config.bootData.settings.anonymousEnabled)) {
            return [];
        }
        const data = yield getGrafanaSearcher().search({
            kind: ['dashboard', 'folder'],
            query: searchQuery,
            limit: MAX_SEARCH_RESULTS,
        });
        const goToSearchResultActions = data.view.map((item) => {
            var _a, _b, _c;
            const { url, name, kind, location } = item; // items are backed by DataFrameView, so must hold the url in a closure
            return {
                id: `go/${kind}${url}`,
                name: `${name}`,
                section: kind === 'dashboard'
                    ? t('command-palette.section.dashboard-search-results', 'Dashboards')
                    : t('command-palette.section.folder-search-results', 'Folders'),
                priority: SEARCH_RESULTS_PRORITY,
                url,
                subtitle: (_c = (_b = (_a = data.view.dataFrame.meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b.locationInfo[location]) === null || _c === void 0 ? void 0 : _c.name,
            };
        });
        return goToSearchResultActions;
    });
}
export function useSearchResults(searchQuery, isShowing) {
    const [searchResults, setSearchResults] = useState([]);
    const [isFetchingSearchResults, setIsFetchingSearchResults] = useState(false);
    const lastSearchTimestamp = useRef(0);
    // Hit dashboards API
    useEffect(() => {
        const timestamp = Date.now();
        if (isShowing && searchQuery.length > 0) {
            setIsFetchingSearchResults(true);
            debouncedSearch(searchQuery).then((resultActions) => {
                // Only keep the results if it's was issued after the most recently resolved search.
                // This prevents results showing out of order if first request is slower than later ones.
                // We don't need to worry about clearing the isFetching state either - if there's a later
                // request in progress, this will clear it for us
                if (timestamp > lastSearchTimestamp.current) {
                    setSearchResults(resultActions);
                    setIsFetchingSearchResults(false);
                    lastSearchTimestamp.current = timestamp;
                }
            });
        }
        else {
            setSearchResults([]);
            setIsFetchingSearchResults(false);
            lastSearchTimestamp.current = timestamp;
        }
    }, [isShowing, searchQuery]);
    return {
        searchResults,
        isFetchingSearchResults,
    };
}
//# sourceMappingURL=dashboardActions.js.map