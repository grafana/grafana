import { createSlice } from '@reduxjs/toolkit';
import { dateTime } from '@grafana/data';
import unifiedAlertingReducer from '../unified/state/reducers';
import alertDef from './alertDef';
export const initialState = {
    items: [],
    searchQuery: '',
    isLoading: false,
};
export const initialChannelState = {
    notificationChannelTypes: [],
    notificationChannel: {},
    notifiers: [],
};
function convertToAlertRule(dto, state) {
    const stateModel = alertDef.getStateDisplayModel(state);
    const rule = Object.assign(Object.assign({}, dto), { stateText: stateModel.text, stateIcon: stateModel.iconClass, stateClass: stateModel.stateClass, stateAge: dateTime(dto.newStateDate).fromNow(true) });
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
const alertRulesSlice = createSlice({
    name: 'alertRules',
    initialState,
    reducers: {
        loadAlertRules: (state) => {
            return Object.assign(Object.assign({}, state), { isLoading: true });
        },
        loadedAlertRules: (state, action) => {
            const alertRules = action.payload;
            const alertRulesViewModel = alertRules.map((rule) => {
                return convertToAlertRule(rule, rule.state);
            });
            return Object.assign(Object.assign({}, state), { items: alertRulesViewModel, isLoading: false });
        },
        setSearchQuery: (state, action) => {
            return Object.assign(Object.assign({}, state), { searchQuery: action.payload });
        },
    },
});
const notificationChannelSlice = createSlice({
    name: 'notificationChannel',
    initialState: initialChannelState,
    reducers: {
        setNotificationChannels: (state, action) => {
            return Object.assign(Object.assign({}, state), { notificationChannelTypes: transformNotifiers(action.payload), notifiers: action.payload });
        },
        notificationChannelLoaded: (state, action) => {
            const notificationChannel = action.payload;
            const selectedType = state.notifiers.find((t) => t.type === notificationChannel.type);
            const secureChannelOptions = selectedType.options.filter((o) => o.secure);
            /*
              If any secure field is in plain text we need to migrate it to use secure field instead.
             */
            if (secureChannelOptions.length > 0 &&
                secureChannelOptions.some((o) => {
                    return notificationChannel.settings[o.propertyName] !== '';
                })) {
                return migrateSecureFields(state, action.payload, secureChannelOptions);
            }
            return Object.assign(Object.assign({}, state), { notificationChannel: notificationChannel });
        },
        resetSecureField: (state, action) => {
            return Object.assign(Object.assign({}, state), { notificationChannel: Object.assign(Object.assign({}, state.notificationChannel), { secureFields: Object.assign(Object.assign({}, state.notificationChannel.secureFields), { [action.payload]: false }) }) });
        },
    },
});
export const { loadAlertRules, loadedAlertRules, setSearchQuery } = alertRulesSlice.actions;
export const { setNotificationChannels, notificationChannelLoaded, resetSecureField } = notificationChannelSlice.actions;
export const alertRulesReducer = alertRulesSlice.reducer;
export const notificationChannelReducer = notificationChannelSlice.reducer;
export default {
    alertRules: alertRulesReducer,
    notificationChannel: notificationChannelReducer,
    unifiedAlerting: unifiedAlertingReducer,
};
function migrateSecureFields(state, notificationChannel, secureChannelOptions) {
    const cleanedSettings = {};
    const secureSettings = {};
    secureChannelOptions.forEach((option) => {
        secureSettings[option.propertyName] = notificationChannel.settings[option.propertyName];
        cleanedSettings[option.propertyName] = '';
    });
    return Object.assign(Object.assign({}, state), { notificationChannel: Object.assign(Object.assign({}, notificationChannel), { settings: Object.assign(Object.assign({}, notificationChannel.settings), cleanedSettings), secureSettings: Object.assign({}, secureSettings) }) });
}
function transformNotifiers(notifiers) {
    return notifiers
        .map((option) => {
        return Object.assign(Object.assign({ value: option.type, label: option.name }, option), { typeName: option.type });
    })
        .sort((o1, o2) => {
        if (o1.name > o2.name) {
            return 1;
        }
        return -1;
    });
}
//# sourceMappingURL=reducers.js.map