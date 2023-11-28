import { __awaiter } from "tslib";
import { createAction } from '@reduxjs/toolkit';
import { getQueryKeys } from 'app/core/utils/explore';
import { getCorrelationsBySourceUIDs } from 'app/features/correlations/utils';
import { getTimeZone } from 'app/features/profile/state/selectors';
import { createAsyncThunk } from 'app/types';
import { datasourceReducer } from './datasource';
import { historyReducer } from './history';
import { richHistorySearchFiltersUpdatedAction, richHistoryUpdatedAction } from './main';
import { queryReducer, runQueries } from './query';
import { timeReducer, updateTime } from './time';
import { makeExplorePaneState, loadAndInitDatasource, createEmptyQueryResponse, getRange, getDatasourceUIDs, } from './utils';
export const changeSizeAction = createAction('explore/changeSize');
const changePanelsStateAction = createAction('explore/changePanels');
export function changePanelState(exploreId, panel, panelState) {
    return (dispatch, getState) => __awaiter(this, void 0, void 0, function* () {
        const exploreItem = getState().explore.panes[exploreId];
        if (exploreItem === undefined) {
            return;
        }
        const { panelsState } = exploreItem;
        dispatch(changePanelsStateAction({
            exploreId,
            panelsState: Object.assign(Object.assign({}, panelsState), { [panel]: panelState }),
        }));
    });
}
export const changeCorrelationHelperData = createAction('explore/changeCorrelationHelperData');
const initializeExploreAction = createAction('explore/initializeExploreAction');
export const setUrlReplacedAction = createAction('explore/setUrlReplaced');
export const saveCorrelationsAction = createAction('explore/saveCorrelationsAction');
/**
 * Keep track of the Explore container size, in particular the width.
 * The width will be used to calculate graph intervals (number of datapoints).
 */
export function changeSize(exploreId, { width }) {
    return changeSizeAction({ exploreId, width });
}
/**
 * Initialize Explore state with state from the URL and the React component.
 * Call this only on components for with the Explore state has not been initialized.
 *
 * The `datasource` param will be passed to the datasource service `get` function
 * and can be either a string that is the name or uid, or a datasourceRef
 * This is to maximize compatability with how datasources are accessed from the URL param.
 */
export const initializeExplore = createAsyncThunk('explore/initializeExplore', ({ exploreId, datasource, queries, range, panelsState, correlationHelperData }, { dispatch, getState, fulfillWithValue }) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    let instance = undefined;
    let history = [];
    if (datasource) {
        const orgId = getState().user.orgId;
        const loadResult = yield loadAndInitDatasource(orgId, datasource);
        instance = loadResult.instance;
        history = loadResult.history;
    }
    dispatch(initializeExploreAction({
        exploreId,
        queries,
        range: getRange(range, getTimeZone(getState().user)),
        datasourceInstance: instance,
        history,
    }));
    if (panelsState !== undefined) {
        dispatch(changePanelsStateAction({ exploreId, panelsState }));
    }
    dispatch(updateTime({ exploreId }));
    if (instance) {
        const datasourceUIDs = getDatasourceUIDs(instance.uid, queries);
        const correlations = yield getCorrelationsBySourceUIDs(datasourceUIDs);
        dispatch(saveCorrelationsAction({ exploreId: exploreId, correlations: correlations.correlations || [] }));
        dispatch(runQueries({ exploreId }));
    }
    // initialize new pane with helper data
    if (correlationHelperData !== undefined && ((_a = getState().explore.correlationEditorDetails) === null || _a === void 0 ? void 0 : _a.editorMode)) {
        dispatch(changeCorrelationHelperData({
            exploreId,
            correlationEditorHelperData: correlationHelperData,
        }));
    }
    return fulfillWithValue({ exploreId, state: getState().explore.panes[exploreId] });
}));
/**
 * Reducer for an Explore area, to be used by the global Explore reducer.
 */
// Redux Toolkit uses ImmerJs as part of their solution to ensure that state objects are not mutated.
// ImmerJs has an autoFreeze option that freezes objects from change which means this reducer can't be migrated to createSlice
// because the state would become frozen and during run time we would get errors because flot (Graph lib) would try to mutate
// the frozen state.
// https://github.com/reduxjs/redux-toolkit/issues/242
export const paneReducer = (state = makeExplorePaneState(), action) => {
    state = queryReducer(state, action);
    state = datasourceReducer(state, action);
    state = timeReducer(state, action);
    state = historyReducer(state, action);
    if (richHistoryUpdatedAction.match(action)) {
        const { richHistory, total } = action.payload.richHistoryResults;
        return Object.assign(Object.assign({}, state), { richHistory, richHistoryTotal: total });
    }
    if (richHistorySearchFiltersUpdatedAction.match(action)) {
        const richHistorySearchFilters = action.payload.filters;
        return Object.assign(Object.assign({}, state), { richHistorySearchFilters });
    }
    if (changeSizeAction.match(action)) {
        const containerWidth = action.payload.width;
        return Object.assign(Object.assign({}, state), { containerWidth });
    }
    if (changePanelsStateAction.match(action)) {
        const { panelsState } = action.payload;
        return Object.assign(Object.assign({}, state), { panelsState });
    }
    if (changeCorrelationHelperData.match(action)) {
        const { correlationEditorHelperData } = action.payload;
        return Object.assign(Object.assign({}, state), { correlationEditorHelperData });
    }
    if (saveCorrelationsAction.match(action)) {
        return Object.assign(Object.assign({}, state), { correlations: action.payload.correlations });
    }
    if (initializeExploreAction.match(action)) {
        const { queries, range, datasourceInstance, history } = action.payload;
        return Object.assign(Object.assign({}, state), { range,
            queries, initialized: true, queryKeys: getQueryKeys(queries), datasourceInstance,
            history, queryResponse: createEmptyQueryResponse(), cache: [], correlations: [] });
    }
    return state;
};
//# sourceMappingURL=explorePane.js.map