import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DataSourceVariableModel, VariableHide, VariableOption, VariableRefresh } from '../../templating/types';
import {
  ALL_VARIABLE_TEXT,
  ALL_VARIABLE_VALUE,
  getInstanceState,
  NEW_VARIABLE_ID,
  VariablePayload,
} from '../state/types';
import { initialVariablesState, VariablesState } from '../state/variablesReducer';
import { DataSourceSelectItem } from '@grafana/data';

export interface DataSourceVariableEditorState {
  dataSourceTypes: Array<{ text: string; value: string }>;
}

export const initialDataSourceVariableModelState: DataSourceVariableModel = {
  id: NEW_VARIABLE_ID,
  global: false,
  type: 'datasource',
  name: '',
  hide: VariableHide.dontHide,
  label: '',
  current: {} as VariableOption,
  regex: '',
  options: [],
  query: '',
  multi: false,
  includeAll: false,
  refresh: VariableRefresh.onDashboardLoad,
  skipUrlSync: false,
  index: -1,
  initLock: null,
};

export const dataSourceVariableSlice = createSlice({
  name: 'templating/datasource',
  initialState: initialVariablesState,
  reducers: {
    createDataSourceOptions: (
      state: VariablesState,
      action: PayloadAction<VariablePayload<{ sources: DataSourceSelectItem[]; regex: RegExp | undefined }>>
    ) => {
      const { sources, regex } = action.payload.data;
      const options: VariableOption[] = [];
      const instanceState = getInstanceState<DataSourceVariableModel>(state, action.payload.id);
      for (let i = 0; i < sources.length; i++) {
        const source = sources[i];
        // must match on type
        if (source.meta.id !== instanceState.query) {
          continue;
        }

        if (regex && !regex.exec(source.name)) {
          continue;
        }

        options.push({ text: source.name, value: source.name, selected: false });
      }

      if (options.length === 0) {
        options.push({ text: 'No data sources found', value: '', selected: false });
      }

      if (instanceState.includeAll) {
        options.unshift({ text: ALL_VARIABLE_TEXT, value: ALL_VARIABLE_VALUE, selected: false });
      }

      instanceState.options = options;
    },
  },
});

export const dataSourceVariableReducer = dataSourceVariableSlice.reducer;

export const { createDataSourceOptions } = dataSourceVariableSlice.actions;
