import { debounce } from 'lodash';
import { locationService } from '@grafana/runtime';
import { StateManagerBase } from 'app/core/services/StateManagerBase';
import store from 'app/core/store';
import { SEARCH_PANELS_LOCAL_STORAGE_KEY, SEARCH_SELECTED_LAYOUT, SEARCH_SELECTED_SORT } from '../constants';
import { reportDashboardListViewed, reportSearchFailedQueryInteraction, reportSearchQueryInteraction, reportSearchResultInteraction, } from '../page/reporting';
import { getGrafanaSearcher } from '../service';
import { SearchLayout } from '../types';
import { parseRouteParams } from '../utils';
export const initialState = {
    query: '',
    tag: [],
    starred: false,
    layout: SearchLayout.Folders,
    sort: undefined,
    prevSort: undefined,
    eventTrackingNamespace: 'dashboard_search',
};
export const defaultQueryParams = {
    sort: null,
    starred: null,
    query: null,
    tag: null,
    layout: null,
};
export class SearchStateManager extends StateManagerBase {
    constructor() {
        super(...arguments);
        this.updateLocation = debounce((query) => locationService.partial(query, true), 300);
        this.doSearchWithDebounce = debounce(() => this.doSearch(), 300);
        this.lastSearchTimestamp = 0;
        this.onCloseSearch = () => {
            this.updateLocation(Object.assign({ search: null, folder: null }, defaultQueryParams));
        };
        this.onClearSearchAndFilters = () => {
            this.setStateAndDoSearch({
                query: '',
                datasource: undefined,
                tag: [],
                panel_type: undefined,
                starred: undefined,
                sort: undefined,
            });
        };
        this.onQueryChange = (query) => {
            this.setStateAndDoSearch({ query });
        };
        this.onRemoveTag = (tagToRemove) => {
            this.setStateAndDoSearch({ tag: this.state.tag.filter((tag) => tag !== tagToRemove) });
        };
        this.onTagFilterChange = (tags) => {
            this.setStateAndDoSearch({ tag: tags });
        };
        this.onAddTag = (newTag) => {
            if (this.state.tag && this.state.tag.includes(newTag)) {
                return;
            }
            this.setStateAndDoSearch({ tag: [...this.state.tag, newTag] });
        };
        this.onDatasourceChange = (datasource) => {
            this.setStateAndDoSearch({ datasource });
        };
        this.onPanelTypeChange = (panel_type) => {
            this.setStateAndDoSearch({ panel_type });
        };
        this.onStarredFilterChange = (e) => {
            const starred = e.currentTarget.checked;
            this.setStateAndDoSearch({ starred });
        };
        this.onClearStarred = () => {
            this.setStateAndDoSearch({ starred: false });
        };
        this.onSortChange = (sort) => {
            if (sort) {
                localStorage.setItem(SEARCH_SELECTED_SORT, sort);
            }
            else {
                localStorage.removeItem(SEARCH_SELECTED_SORT);
            }
            if (this.state.layout === SearchLayout.Folders) {
                this.setStateAndDoSearch({ sort, layout: SearchLayout.List });
            }
            else {
                this.setStateAndDoSearch({ sort });
            }
        };
        this.onLayoutChange = (layout) => {
            localStorage.setItem(SEARCH_SELECTED_LAYOUT, layout);
            if (this.state.sort && layout === SearchLayout.Folders) {
                this.setStateAndDoSearch({ layout, prevSort: this.state.sort, sort: undefined });
            }
            else {
                this.setStateAndDoSearch({ layout, sort: this.state.prevSort });
            }
        };
        this.onSetIncludePanels = (includePanels) => {
            this.setStateAndDoSearch({ includePanels });
            store.set(SEARCH_PANELS_LOCAL_STORAGE_KEY, includePanels);
        };
        // This gets the possible tags from within the query results
        this.getTagOptions = () => {
            var _a;
            const query = (_a = this.lastQuery) !== null && _a !== void 0 ? _a : {
                kind: ['dashboard', 'folder'],
                query: '*',
            };
            return getGrafanaSearcher().tags(query);
        };
        /**
         * When item is selected clear some filters and report interaction
         */
        this.onSearchItemClicked = (e) => {
            var _a;
            reportSearchResultInteraction(this.state.eventTrackingNamespace, {
                layout: this.state.layout,
                starred: this.state.starred,
                sortValue: this.state.sort,
                query: this.state.query,
                tagCount: (_a = this.state.tag) === null || _a === void 0 ? void 0 : _a.length,
                includePanels: this.state.includePanels,
            });
        };
        /**
         * Caller should handle debounce
         */
        this.onReportSearchUsage = () => {
            var _a;
            reportDashboardListViewed(this.state.eventTrackingNamespace, {
                layout: this.state.layout,
                starred: this.state.starred,
                sortValue: this.state.sort,
                query: this.state.query,
                tagCount: (_a = this.state.tag) === null || _a === void 0 ? void 0 : _a.length,
                includePanels: this.state.includePanels,
            });
        };
    }
    initStateFromUrl(folderUid, doInitialSearch = true) {
        const stateFromUrl = parseRouteParams(locationService.getSearchObject());
        // Force list view when conditions are specified from the URL
        if (stateFromUrl.query || stateFromUrl.datasource || stateFromUrl.panel_type) {
            stateFromUrl.layout = SearchLayout.List;
        }
        stateManager.setState(Object.assign(Object.assign(Object.assign({}, initialState), stateFromUrl), { folderUid: folderUid, eventTrackingNamespace: folderUid ? 'manage_dashboards' : 'dashboard_search' }));
        if (doInitialSearch) {
            this.doSearch();
        }
    }
    /**
     * Updates internal and url state, then triggers a new search
     */
    setStateAndDoSearch(state) {
        const sort = state.sort || this.state.sort || localStorage.getItem(SEARCH_SELECTED_SORT) || undefined;
        // Set internal state
        this.setState(Object.assign({ sort }, state));
        // Update url state
        this.updateLocation({
            query: this.state.query.length === 0 ? null : this.state.query,
            tag: this.state.tag,
            datasource: this.state.datasource,
            panel_type: this.state.panel_type,
            starred: this.state.starred ? this.state.starred : null,
            sort: this.state.sort,
        });
        // issue new search query
        this.doSearchWithDebounce();
    }
    hasSearchFilters() {
        return this.state.query || this.state.tag.length || this.state.starred || this.state.panel_type || this.state.sort;
    }
    getSearchQuery() {
        var _a, _b, _c;
        const q = {
            query: this.state.query,
            tags: this.state.tag,
            ds_uid: this.state.datasource,
            panel_type: this.state.panel_type,
            location: this.state.folderUid,
            sort: this.state.sort,
            explain: this.state.explain,
            withAllowedActions: this.state.explain,
            starred: this.state.starred,
        };
        // Only dashboards have additional properties
        if (((_a = q.sort) === null || _a === void 0 ? void 0 : _a.length) && !q.sort.includes('name')) {
            q.kind = ['dashboard', 'folder']; // skip panels
        }
        if (!((_b = q.query) === null || _b === void 0 ? void 0 : _b.length)) {
            q.query = '*';
            if (!q.location) {
                q.kind = ['dashboard', 'folder']; // skip panels
            }
        }
        if (!this.state.includePanels && !q.kind) {
            q.kind = ['dashboard', 'folder']; // skip panels
        }
        if ((_c = q.panel_type) === null || _c === void 0 ? void 0 : _c.length) {
            q.kind = ['panel'];
        }
        return q;
    }
    doSearch() {
        var _a;
        const trackingInfo = {
            layout: this.state.layout,
            starred: this.state.starred,
            sortValue: this.state.sort,
            query: this.state.query,
            tagCount: (_a = this.state.tag) === null || _a === void 0 ? void 0 : _a.length,
            includePanels: this.state.includePanels,
        };
        reportSearchQueryInteraction(this.state.eventTrackingNamespace, trackingInfo);
        this.lastQuery = this.getSearchQuery();
        this.setState({ loading: true });
        const searcher = getGrafanaSearcher();
        const searchTimestamp = Date.now();
        const searchPromise = this.state.starred ? searcher.starred(this.lastQuery) : searcher.search(this.lastQuery);
        searchPromise
            .then((result) => {
            // Only keep the results if it's was issued after the most recently resolved search.
            // This prevents results showing out of order if first request is slower than later ones
            if (searchTimestamp > this.lastSearchTimestamp) {
                this.setState({ result, loading: false });
                this.lastSearchTimestamp = searchTimestamp;
            }
        })
            .catch((error) => {
            reportSearchFailedQueryInteraction(this.state.eventTrackingNamespace, Object.assign(Object.assign({}, trackingInfo), { error: error === null || error === void 0 ? void 0 : error.message }));
            this.setState({ loading: false });
        });
    }
}
let stateManager;
export function getSearchStateManager() {
    if (!stateManager) {
        const selectedLayout = localStorage.getItem(SEARCH_SELECTED_LAYOUT);
        const layout = selectedLayout !== null && selectedLayout !== void 0 ? selectedLayout : initialState.layout;
        let includePanels = store.getBool(SEARCH_PANELS_LOCAL_STORAGE_KEY, true);
        if (includePanels) {
            includePanels = false;
        }
        stateManager = new SearchStateManager(Object.assign(Object.assign({}, initialState), { layout, includePanels }));
    }
    return stateManager;
}
export function useSearchStateManager() {
    const stateManager = getSearchStateManager();
    const state = stateManager.useState();
    return [state, stateManager];
}
//# sourceMappingURL=SearchStateManager.js.map