import { combineReducers } from 'redux';
import { createAsyncSlice } from '../utils/redux';
import { fetchRulesAction } from './actions';

export const reducer = combineReducers({
  rules: createAsyncSlice('rules', fetchRulesAction).reducer,
});

export type UnifiedAlertingState = ReturnType<typeof reducer>;

export default reducer;
