import { combineReducers } from 'redux';
import { createAsyncMapSlice } from '../utils/redux';
import { fetchRulesAction } from './actions';

export const reducer = combineReducers({
  rules: createAsyncMapSlice('rules', fetchRulesAction, (datasourceName) => datasourceName).reducer,
});

export type UnifiedAlertingState = ReturnType<typeof reducer>;

export default reducer;
