import { __assign, __awaiter, __generator } from "tslib";
// Libraries
import { createAction } from '@reduxjs/toolkit';
import { RefreshPicker } from '@grafana/ui';
import { stopQueryState } from 'app/core/utils/explore';
import { importQueries, runQueries } from './query';
import { changeRefreshInterval } from './time';
import { createEmptyQueryResponse, loadAndInitDatasource } from './utils';
export var updateDatasourceInstanceAction = createAction('explore/updateDatasourceInstance');
//
// Action creators
//
/**
 * Loads a new datasource identified by the given name.
 */
export function changeDatasource(exploreId, datasourceUid, options) {
    var _this = this;
    return function (dispatch, getState) { return __awaiter(_this, void 0, void 0, function () {
        var orgId, _a, history, instance, currentDataSourceInstance, queries;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    orgId = getState().user.orgId;
                    return [4 /*yield*/, loadAndInitDatasource(orgId, datasourceUid)];
                case 1:
                    _a = _b.sent(), history = _a.history, instance = _a.instance;
                    currentDataSourceInstance = getState().explore[exploreId].datasourceInstance;
                    dispatch(updateDatasourceInstanceAction({
                        exploreId: exploreId,
                        datasourceInstance: instance,
                        history: history,
                    }));
                    if (!(options === null || options === void 0 ? void 0 : options.importQueries)) return [3 /*break*/, 3];
                    queries = getState().explore[exploreId].queries;
                    return [4 /*yield*/, dispatch(importQueries(exploreId, queries, currentDataSourceInstance, instance))];
                case 2:
                    _b.sent();
                    _b.label = 3;
                case 3:
                    if (getState().explore[exploreId].isLive) {
                        dispatch(changeRefreshInterval(exploreId, RefreshPicker.offOption.value));
                    }
                    // Exception - we only want to run queries on data source change, if the queries were imported
                    if (options === null || options === void 0 ? void 0 : options.importQueries) {
                        dispatch(runQueries(exploreId));
                    }
                    return [2 /*return*/];
            }
        });
    }); };
}
//
// Reducer
//
/**
 * Reducer for an Explore area, to be used by the global Explore reducer.
 */
// Redux Toolkit uses ImmerJs as part of their solution to ensure that state objects are not mutated.
// ImmerJs has an autoFreeze option that freezes objects from change which means this reducer can't be migrated to createSlice
// because the state would become frozen and during run time we would get errors because flot (Graph lib) would try to mutate
// the frozen state.
// https://github.com/reduxjs/redux-toolkit/issues/242
export var datasourceReducer = function (state, action) {
    if (updateDatasourceInstanceAction.match(action)) {
        var _a = action.payload, datasourceInstance = _a.datasourceInstance, history_1 = _a.history;
        // Custom components
        stopQueryState(state.querySubscription);
        return __assign(__assign({}, state), { datasourceInstance: datasourceInstance, graphResult: null, tableResult: null, logsResult: null, logsVolumeDataProvider: undefined, logsVolumeData: undefined, queryResponse: createEmptyQueryResponse(), loading: false, queryKeys: [], history: history_1, datasourceMissing: false });
    }
    return state;
};
//# sourceMappingURL=datasource.js.map