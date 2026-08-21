import { combineReducers } from 'redux';

import { type RuleNamespace, type StateHistoryItem } from 'app/types/unified-alerting';
import { type RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { createAsyncMapSliceForTypePrefix, createAsyncSliceForTypePrefix } from '../utils/asyncRequestState';

import { alertingActionTypePrefix } from './actionTypes';

const reducer = combineReducers({
  promRules: createAsyncMapSliceForTypePrefix<RuleNamespace[], { rulesSourceName: string }>(
    'promRules',
    alertingActionTypePrefix.fetchPromRules,
    ({ rulesSourceName }) => rulesSourceName
  ).reducer,
  rulerRules: createAsyncMapSliceForTypePrefix<RulerRulesConfigDTO | null, { rulesSourceName: string }>(
    'rulerRules',
    alertingActionTypePrefix.fetchRulerRules,
    ({ rulesSourceName }) => rulesSourceName
  ).reducer,
  saveAMConfig: createAsyncSliceForTypePrefix<void>(
    'saveAMConfig',
    alertingActionTypePrefix.updateAlertManagerConfig
  ).reducer,
  deleteAMConfig: createAsyncSliceForTypePrefix<void>(
    'deleteAMConfig',
    alertingActionTypePrefix.deleteAlertManagerConfig
  ).reducer,
  managedAlertStateHistory: createAsyncSliceForTypePrefix<StateHistoryItem[]>(
    'managedAlertStateHistory',
    alertingActionTypePrefix.fetchGrafanaAnnotations
  ).reducer,
});

export type UnifiedAlertingState = ReturnType<typeof reducer>;

export default reducer;
