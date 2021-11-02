var _a, _b;
import { __assign } from "tslib";
import { createSlice } from '@reduxjs/toolkit';
import { dateTime } from '@grafana/data';
import alertDef from './alertDef';
import unifiedAlertingReducer from '../unified/state/reducers';
export var initialState = {
    items: [],
    searchQuery: '',
    isLoading: false,
};
export var initialChannelState = {
    notificationChannelTypes: [],
    notificationChannel: {},
    notifiers: [],
};
function convertToAlertRule(dto, state) {
    var stateModel = alertDef.getStateDisplayModel(state);
    var rule = __assign(__assign({}, dto), { stateText: stateModel.text, stateIcon: stateModel.iconClass, stateClass: stateModel.stateClass, stateAge: dateTime(dto.newStateDate).fromNow(true) });
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
var alertRulesSlice = createSlice({
    name: 'alertRules',
    initialState: initialState,
    reducers: {
        loadAlertRules: function (state) {
            return __assign(__assign({}, state), { isLoading: true });
        },
        loadedAlertRules: function (state, action) {
            var alertRules = action.payload;
            var alertRulesViewModel = alertRules.map(function (rule) {
                return convertToAlertRule(rule, rule.state);
            });
            return __assign(__assign({}, state), { items: alertRulesViewModel, isLoading: false });
        },
        setSearchQuery: function (state, action) {
            return __assign(__assign({}, state), { searchQuery: action.payload });
        },
    },
});
var notificationChannelSlice = createSlice({
    name: 'notificationChannel',
    initialState: initialChannelState,
    reducers: {
        setNotificationChannels: function (state, action) {
            return __assign(__assign({}, state), { notificationChannelTypes: transformNotifiers(action.payload), notifiers: action.payload });
        },
        notificationChannelLoaded: function (state, action) {
            var notificationChannel = action.payload;
            var selectedType = state.notifiers.find(function (t) { return t.type === notificationChannel.type; });
            var secureChannelOptions = selectedType.options.filter(function (o) { return o.secure; });
            /*
              If any secure field is in plain text we need to migrate it to use secure field instead.
             */
            if (secureChannelOptions.length > 0 &&
                secureChannelOptions.some(function (o) {
                    return notificationChannel.settings[o.propertyName] !== '';
                })) {
                return migrateSecureFields(state, action.payload, secureChannelOptions);
            }
            return __assign(__assign({}, state), { notificationChannel: notificationChannel });
        },
        resetSecureField: function (state, action) {
            var _a;
            return __assign(__assign({}, state), { notificationChannel: __assign(__assign({}, state.notificationChannel), { secureFields: __assign(__assign({}, state.notificationChannel.secureFields), (_a = {}, _a[action.payload] = false, _a)) }) });
        },
    },
});
export var loadAlertRules = (_a = alertRulesSlice.actions, _a.loadAlertRules), loadedAlertRules = _a.loadedAlertRules, setSearchQuery = _a.setSearchQuery;
export var setNotificationChannels = (_b = notificationChannelSlice.actions, _b.setNotificationChannels), notificationChannelLoaded = _b.notificationChannelLoaded, resetSecureField = _b.resetSecureField;
export var alertRulesReducer = alertRulesSlice.reducer;
export var notificationChannelReducer = notificationChannelSlice.reducer;
export default {
    alertRules: alertRulesReducer,
    notificationChannel: notificationChannelReducer,
    unifiedAlerting: unifiedAlertingReducer,
};
function migrateSecureFields(state, notificationChannel, secureChannelOptions) {
    var cleanedSettings = {};
    var secureSettings = {};
    secureChannelOptions.forEach(function (option) {
        secureSettings[option.propertyName] = notificationChannel.settings[option.propertyName];
        cleanedSettings[option.propertyName] = '';
    });
    return __assign(__assign({}, state), { notificationChannel: __assign(__assign({}, notificationChannel), { settings: __assign(__assign({}, notificationChannel.settings), cleanedSettings), secureSettings: __assign({}, secureSettings) }) });
}
function transformNotifiers(notifiers) {
    return notifiers
        .map(function (option) {
        return __assign(__assign({ value: option.type, label: option.name }, option), { typeName: option.type });
    })
        .sort(function (o1, o2) {
        if (o1.name > o2.name) {
            return 1;
        }
        return -1;
    });
}
//# sourceMappingURL=reducers.js.map