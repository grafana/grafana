import { combineReducers } from 'redux';
import { createAsyncMapSlice } from '../utils/redux';
import { fetchAlertManagerConfigAction, fetchPromRulesAction } from './actions';

export const reducer = combineReducers({
  promRules: createAsyncMapSlice('promRules', fetchPromRulesAction, (dataSourceName) => dataSourceName).reducer,
  amConfigs: createAsyncMapSlice(
    'amConfigs',
    fetchAlertManagerConfigAction,
    (alertManagerSourceName) => alertManagerSourceName
  ).reducer,
});

export type UnifiedAlertingState = ReturnType<typeof reducer>;

export default reducer;
