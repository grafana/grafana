import { __awaiter } from "tslib";
// Libraries
import { createAction } from '@reduxjs/toolkit';
import { reportInteraction } from '@grafana/runtime';
import { RefreshPicker } from '@grafana/ui';
import { stopQueryState } from 'app/core/utils/explore';
import { getCorrelationsBySourceUIDs } from 'app/features/correlations/utils';
import { loadSupplementaryQueries } from '../utils/supplementaryQueries';
import { saveCorrelationsAction } from './explorePane';
import { importQueries, runQueries } from './query';
import { changeRefreshInterval } from './time';
import { createEmptyQueryResponse, getDatasourceUIDs, loadAndInitDatasource } from './utils';
export const updateDatasourceInstanceAction = createAction('explore/updateDatasourceInstance');
//
// Action creators
//
/**
 * Loads a new datasource identified by the given name.
 */
export function changeDatasource(exploreId, datasource, options) {
    return (dispatch, getState) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const orgId = getState().user.orgId;
        const { history, instance } = yield loadAndInitDatasource(orgId, datasource);
        const currentDataSourceInstance = getState().explore.panes[exploreId].datasourceInstance;
        reportInteraction('explore_change_ds', {
            from: (((_a = currentDataSourceInstance === null || currentDataSourceInstance === void 0 ? void 0 : currentDataSourceInstance.meta) === null || _a === void 0 ? void 0 : _a.mixed) ? 'mixed' : currentDataSourceInstance === null || currentDataSourceInstance === void 0 ? void 0 : currentDataSourceInstance.type) || 'unknown',
            to: instance.meta.mixed ? 'mixed' : instance.type,
            exploreId,
        });
        dispatch(updateDatasourceInstanceAction({
            exploreId,
            datasourceInstance: instance,
            history,
        }));
        const queries = getState().explore.panes[exploreId].queries;
        const datasourceUIDs = getDatasourceUIDs(instance.uid, queries);
        const correlations = yield getCorrelationsBySourceUIDs(datasourceUIDs);
        dispatch(saveCorrelationsAction({ exploreId: exploreId, correlations: correlations.correlations || [] }));
        if (options === null || options === void 0 ? void 0 : options.importQueries) {
            yield dispatch(importQueries(exploreId, queries, currentDataSourceInstance, instance));
        }
        if (getState().explore.panes[exploreId].isLive) {
            dispatch(changeRefreshInterval({ exploreId, refreshInterval: RefreshPicker.offOption.value }));
        }
        // Exception - we only want to run queries on data source change, if the queries were imported
        if (options === null || options === void 0 ? void 0 : options.importQueries) {
            dispatch(runQueries({ exploreId }));
        }
    });
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
export const datasourceReducer = (state, action) => {
    if (updateDatasourceInstanceAction.match(action)) {
        const { datasourceInstance, history } = action.payload;
        // Custom components
        stopQueryState(state.querySubscription);
        return Object.assign(Object.assign({}, state), { datasourceInstance, graphResult: null, tableResult: null, logsResult: null, supplementaryQueries: loadSupplementaryQueries(), queryResponse: createEmptyQueryResponse(), queryKeys: [], history });
    }
    return state;
};
//# sourceMappingURL=datasource.js.map