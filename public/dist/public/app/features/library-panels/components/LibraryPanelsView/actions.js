import { __assign, __awaiter, __generator } from "tslib";
import { from, merge, of, Subscription, timer } from 'rxjs';
import { catchError, finalize, mapTo, mergeMap, share, takeUntil } from 'rxjs/operators';
import { deleteLibraryPanel as apiDeleteLibraryPanel, getLibraryPanels } from '../../state/api';
import { initialLibraryPanelsViewState, initSearch, searchCompleted } from './reducer';
export function searchForLibraryPanels(args) {
    return function (dispatch) {
        var subscription = new Subscription();
        var dataObservable = from(getLibraryPanels({
            searchString: args.searchString,
            perPage: args.perPage,
            page: args.page,
            excludeUid: args.currentPanelId,
            sortDirection: args.sortDirection,
            typeFilter: args.panelFilter,
            folderFilter: args.folderFilter,
        })).pipe(mergeMap(function (_a) {
            var perPage = _a.perPage, libraryPanels = _a.elements, page = _a.page, totalCount = _a.totalCount;
            return of(searchCompleted({ libraryPanels: libraryPanels, page: page, perPage: perPage, totalCount: totalCount }));
        }), catchError(function (err) {
            console.error(err);
            return of(searchCompleted(__assign(__assign({}, initialLibraryPanelsViewState), { page: args.page, perPage: args.perPage })));
        }), finalize(function () { return subscription.unsubscribe(); }), // make sure we unsubscribe
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
        return __awaiter(this, void 0, void 0, function () {
            var e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, apiDeleteLibraryPanel(uid)];
                    case 1:
                        _a.sent();
                        searchForLibraryPanels(args)(dispatch);
                        return [3 /*break*/, 3];
                    case 2:
                        e_1 = _a.sent();
                        console.error(e_1);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
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