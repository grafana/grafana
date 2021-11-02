import { __assign } from "tslib";
import { combineReducers } from 'redux';
import { cleanUpAction } from '../actions/cleanUp';
import sharedReducers from 'app/core/reducers';
import alertingReducers from 'app/features/alerting/state/reducers';
import teamsReducers from 'app/features/teams/state/reducers';
import apiKeysReducers from 'app/features/api-keys/state/reducers';
import foldersReducers from 'app/features/folders/state/reducers';
import dashboardReducers from 'app/features/dashboard/state/reducers';
import exploreReducers from 'app/features/explore/state/main';
import pluginReducers from 'app/features/plugins/state/reducers';
import dataSourcesReducers from 'app/features/datasources/state/reducers';
import usersReducers from 'app/features/users/state/reducers';
import userReducers from 'app/features/profile/state/reducers';
import organizationReducers from 'app/features/org/state/reducers';
import ldapReducers from 'app/features/admin/state/reducers';
import templatingReducers from 'app/features/variables/state/reducers';
import importDashboardReducers from 'app/features/manage-dashboards/state/reducers';
import panelEditorReducers from 'app/features/dashboard/components/PanelEditor/state/reducers';
import panelsReducers from 'app/features/panel/state/reducers';
var rootReducers = __assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign({}, sharedReducers), alertingReducers), teamsReducers), apiKeysReducers), foldersReducers), dashboardReducers), exploreReducers), pluginReducers), dataSourcesReducers), usersReducers), userReducers), organizationReducers), ldapReducers), templatingReducers), importDashboardReducers), panelEditorReducers), panelsReducers);
var addedReducers = {};
export var addReducer = function (newReducers) {
    Object.assign(addedReducers, newReducers);
};
export var createRootReducer = function () {
    var appReducer = combineReducers(__assign(__assign({}, rootReducers), addedReducers));
    return function (state, action) {
        if (action.type !== cleanUpAction.type) {
            return appReducer(state, action);
        }
        var stateSelector = action.payload.stateSelector;
        var stateSlice = stateSelector(state);
        recursiveCleanState(state, stateSlice);
        return appReducer(state, action);
    };
};
export var recursiveCleanState = function (state, stateSlice) {
    for (var stateKey in state) {
        if (!state.hasOwnProperty(stateKey)) {
            continue;
        }
        var slice = state[stateKey];
        if (slice === stateSlice) {
            state[stateKey] = undefined;
            return true;
        }
        if (typeof slice === 'object') {
            var cleaned = recursiveCleanState(slice, stateSlice);
            if (cleaned) {
                return true;
            }
        }
    }
    return false;
};
//# sourceMappingURL=root.js.map