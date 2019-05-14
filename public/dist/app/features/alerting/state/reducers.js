import * as tslib_1 from "tslib";
import moment from 'moment';
import { ActionTypes } from './actions';
import alertDef from './alertDef';
export var initialState = { items: [], searchQuery: '', isLoading: false };
function convertToAlertRule(rule, state) {
    var stateModel = alertDef.getStateDisplayModel(state);
    rule.stateText = stateModel.text;
    rule.stateIcon = stateModel.iconClass;
    rule.stateClass = stateModel.stateClass;
    rule.stateAge = moment(rule.newStateDate)
        .fromNow()
        .replace(' ago', '');
    if (rule.state !== 'paused') {
        if (rule.executionError) {
            rule.info = 'Execution Error: ' + rule.executionError;
        }
        if (rule.evalData && rule.evalData.noData) {
            rule.info = 'Query returned no data';
        }
    }
    return rule;
}
export var alertRulesReducer = function (state, action) {
    if (state === void 0) { state = initialState; }
    switch (action.type) {
        case ActionTypes.LoadAlertRules: {
            return tslib_1.__assign({}, state, { isLoading: true });
        }
        case ActionTypes.LoadedAlertRules: {
            var alertRules = action.payload;
            var alertRulesViewModel = alertRules.map(function (rule) {
                return convertToAlertRule(rule, rule.state);
            });
            return tslib_1.__assign({}, state, { items: alertRulesViewModel, isLoading: false });
        }
        case ActionTypes.SetSearchQuery:
            return tslib_1.__assign({}, state, { searchQuery: action.payload });
    }
    return state;
};
export default {
    alertRules: alertRulesReducer,
};
//# sourceMappingURL=reducers.js.map