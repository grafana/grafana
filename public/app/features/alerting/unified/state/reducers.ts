import { combineReducers } from 'redux';
import { createAsyncMapSlice } from '../utils/redux';
import { fetchAlertManagerConfigAction, fetchRulesAction } from './actions';

export const reducer = combineReducers({
  rules: createAsyncMapSlice('rules', fetchRulesAction, (dataSourceName) => dataSourceName).reducer,
  amConfigs: createAsyncMapSlice(
    'amConfigs',
    fetchAlertManagerConfigAction,
    (alertManagerSourceName) => alertManagerSourceName
  ).reducer,
});

export type UnifiedAlertingState = ReturnType<typeof reducer>;

export default reducer;
