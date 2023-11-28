import { __awaiter } from "tslib";
import { from, merge, of, Subscription, timer } from 'rxjs';
import { catchError, finalize, mapTo, mergeMap, share, takeUntil } from 'rxjs/operators';
import { config } from '@grafana/runtime';
import { getAllPanelPluginMeta } from 'app/features/panel/state/util';
import { deleteLibraryPanel as apiDeleteLibraryPanel, getLibraryPanels } from '../../state/api';
import { initialLibraryPanelsViewState, initSearch, searchCompleted } from './reducer';
export function searchForLibraryPanels(args) {
    // Functions to support filtering out library panels per plugin type that have skipDataQuery set to true
    const findPluginMeta = (pluginMeta, libraryPanel) => pluginMeta.id === libraryPanel.type;
    const filterLibraryPanels = (libraryPanels, isWidget) => {
        const pluginMetaList = getAllPanelPluginMeta();
        return libraryPanels.filter((libraryPanel) => {
            const matchingPluginMeta = pluginMetaList.find((pluginMeta) => findPluginMeta(pluginMeta, libraryPanel));
            // widget mode filter
            if (isWidget) {
                return !!(matchingPluginMeta === null || matchingPluginMeta === void 0 ? void 0 : matchingPluginMeta.skipDataQuery);
            }
            // non-widget mode filter
            return !(matchingPluginMeta === null || matchingPluginMeta === void 0 ? void 0 : matchingPluginMeta.skipDataQuery);
        });
    };
    return function (dispatch) {
        const subscription = new Subscription();
        const dataObservable = from(getLibraryPanels({
            searchString: args.searchString,
            perPage: args.perPage,
            page: args.page,
            excludeUid: args.currentPanelId,
            sortDirection: args.sortDirection,
            typeFilter: args.panelFilter,
            folderFilterUIDs: args.folderFilterUIDs,
        })).pipe(
        //filter out library panels per plugin type that have skipDataQuery set to true
        mergeMap((libraryPanelsResult) => {
            const { elements: libraryPanels } = libraryPanelsResult;
            if (config.featureToggles.vizAndWidgetSplit && args.isWidget !== undefined) {
                const filteredLibraryPanels = filterLibraryPanels(libraryPanels, args.isWidget);
                return of(Object.assign(Object.assign({}, libraryPanelsResult), { elements: filteredLibraryPanels }));
            }
            return of(Object.assign(Object.assign({}, libraryPanelsResult), { elements: libraryPanels }));
        }), mergeMap(({ perPage, elements: libraryPanels, page, totalCount }) => of(searchCompleted({ libraryPanels, page, perPage, totalCount }))), catchError((err) => {
            console.error(err);
            return of(searchCompleted(Object.assign(Object.assign({}, initialLibraryPanelsViewState), { page: args.page, perPage: args.perPage })));
        }), finalize(() => subscription.unsubscribe()), // make sure we unsubscribe
        share());
        subscription.add(
        // If 50ms without a response dispatch a loading state
        // mapTo will translate the timer event into a loading state
        // takeUntil will cancel the timer emit when first response is received on the dataObservable
        merge(timer(50).pipe(mapTo(initSearch()), takeUntil(dataObservable)), dataObservable).subscribe(dispatch));
    };
}
export function deleteLibraryPanel(uid, args) {
    return function (dispatch) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield apiDeleteLibraryPanel(uid);
                searchForLibraryPanels(args)(dispatch);
            }
            catch (e) {
                console.error(e);
            }
        });
    };
}
export function asyncDispatcher(dispatch) {
    return function (action) {
        if (action instanceof Function) {
            return action(dispatch);
        }
        return dispatch(action);
    };
}
//# sourceMappingURL=actions.js.map