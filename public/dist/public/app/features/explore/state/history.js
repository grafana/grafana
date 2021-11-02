import { __assign } from "tslib";
import { deleteAllFromRichHistory, deleteQueryInRichHistory, updateCommentInRichHistory, updateStarredInRichHistory, } from 'app/core/utils/richHistory';
import { richHistoryUpdatedAction } from './main';
import { createAction } from '@reduxjs/toolkit';
export var historyUpdatedAction = createAction('explore/historyUpdated');
//
// Action creators
//
export var updateRichHistory = function (ts, property, updatedProperty) {
    return function (dispatch, getState) {
        // Side-effect: Saving rich history in localstorage
        var nextRichHistory;
        if (property === 'starred') {
            nextRichHistory = updateStarredInRichHistory(getState().explore.richHistory, ts);
        }
        if (property === 'comment') {
            nextRichHistory = updateCommentInRichHistory(getState().explore.richHistory, ts, updatedProperty);
        }
        if (property === 'delete') {
            nextRichHistory = deleteQueryInRichHistory(getState().explore.richHistory, ts);
        }
        dispatch(richHistoryUpdatedAction({ richHistory: nextRichHistory }));
    };
};
export var deleteRichHistory = function () {
    return function (dispatch) {
        deleteAllFromRichHistory();
        dispatch(richHistoryUpdatedAction({ richHistory: [] }));
    };
};
export var historyReducer = function (state, action) {
    if (historyUpdatedAction.match(action)) {
        return __assign(__assign({}, state), { history: action.payload.history });
    }
    return state;
};
//# sourceMappingURL=history.js.map