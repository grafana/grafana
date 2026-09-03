import { combineReducers } from 'redux';

import { type RuleNamespace, type StateHistoryItem } from 'app/types/unified-alerting';
import { type RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { createAsyncMapSlice, createAsyncSlice } from '../utils/redux';

import { alertingActionTypePrefix } from './actionTypes';

const createRulesSlice = <T>(name: string, typePrefix: string) =>
  createAsyncMapSlice<T, { rulesSourceName: string }>(name, typePrefix, ({ rulesSourceName }) => rulesSourceName);

const reducer = combineReducers({
  promRules: createRulesSlice<RuleNamespace[]>('promRules', alertingActionTypePrefix.fetchPromRules).reducer,
  rulerRules: createRulesSlice<RulerRulesConfigDTO | null>('rulerRules', alertingActionTypePrefix.fetchRulerRules)
    .reducer,
  saveAMConfig: createAsyncSlice<void>('saveAMConfig', alertingActionTypePrefix.updateAlertManagerConfig).reducer,
  deleteAMConfig: createAsyncSlice<void>('deleteAMConfig', alertingActionTypePrefix.deleteAlertManagerConfig).reducer,
  managedAlertStateHistory: createAsyncSlice<StateHistoryItem[]>(
    'managedAlertStateHistory',
    alertingActionTypePrefix.fetchGrafanaAnnotations
  ).reducer,
});

export type UnifiedAlertingState = ReturnType<typeof reducer>;

export default reducer;
