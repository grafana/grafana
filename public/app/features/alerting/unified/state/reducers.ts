import { combineReducers } from 'redux';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createAsyncMapSlice, createAsyncSlice } from '../utils/redux';
import {
  fetchAlertManagerConfigAction,
  fetchPromRulesAction,
  fetchRulerRulesAction,
  fetchSilencesAction,
  saveRuleFormAction,
} from './actions';

type FilterState = {
  queryString?: string;
  dataSource?: string;
  alertState?: string;
};

const rulesFiltersInitialState = {
  rulesFilters: {} as FilterState,
};

export const rulesFiltersSlice = createSlice({
  name: 'rulesFilters',
  initialState: rulesFiltersInitialState,
  reducers: {
    clearFilters: (state) => {
      state.rulesFilters = {
        queryString: '',
        dataSource: '',
      };
      return state;
    },
    setDataSource: (state, action: PayloadAction<string>) => {
      state.rulesFilters.dataSource = action.payload;
      return state;
    },
    setQueryString: (state, action: PayloadAction<string>) => {
      state.rulesFilters.queryString = action.payload;
      return state;
    },
    setAlertState: (state, action: PayloadAction<string>) => {
      state.rulesFilters.alertState = action.payload;
      return state;
    },
  },
});

export const reducer = combineReducers({
  promRules: createAsyncMapSlice('promRules', fetchPromRulesAction, (dataSourceName) => dataSourceName).reducer,
  rulerRules: createAsyncMapSlice('rulerRules', fetchRulerRulesAction, (dataSourceName) => dataSourceName).reducer,
  amConfigs: createAsyncMapSlice(
    'amConfigs',
    fetchAlertManagerConfigAction,
    (alertManagerSourceName) => alertManagerSourceName
  ).reducer,
  silences: createAsyncMapSlice('silences', fetchSilencesAction, (alertManagerSourceName) => alertManagerSourceName)
    .reducer,
  ruleForm: combineReducers({
    saveRule: createAsyncSlice('saveRule', saveRuleFormAction).reducer,
  }),
});

export type UnifiedAlertingState = ReturnType<typeof reducer>;

export default reducer;
