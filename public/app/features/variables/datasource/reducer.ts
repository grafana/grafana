import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import {
  DataSourceInstanceSettings,
  DataSourceVariableModel,
  matchPluginId,
  VariableOption,
  VariableRefresh,
} from '@grafana/data';
import { t } from '@grafana/i18n';

import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from '../constants';
import { getInstanceState } from '../state/selectors';
import { initialVariablesState, VariablePayload, VariablesState } from '../state/types';
import { initialVariableModelState } from '../types';

export const initialDataSourceVariableModelState: DataSourceVariableModel = {
  ...initialVariableModelState,
  type: 'datasource',
  current: {},
  regex: '',
  options: [],
  query: '',
  multi: false,
  includeAll: false,
  refresh: VariableRefresh.onDashboardLoad,
};

export const dataSourceVariableSlice = createSlice({
  name: 'templating/datasource',
  initialState: initialVariablesState,
  reducers: {
    createDataSourceOptions: (
      state: VariablesState,
      action: PayloadAction<VariablePayload<{ sources: DataSourceInstanceSettings[]; regex: RegExp | undefined }>>
    ) => {
      const { sources, regex } = action.payload.data;
      const options: VariableOption[] = [];
      const instanceState = getInstanceState(state, action.payload.id);
      if (instanceState.type !== 'datasource') {
        return;
      }

      for (let i = 0; i < sources.length; i++) {
        const source = sources[i];

        if (!matchPluginId(instanceState.query, source.meta)) {
          continue;
        }

        if (isValid(source, regex)) {
          options.push({ text: source.name, value: source.uid, selected: false });
        }

        if (isDefault(source, regex)) {
          options.push({
            text: t('variables.data-source-variable-slice.text.default', 'default'),
            value: 'default',
            selected: false,
          });
        }
      }

      if (options.length === 0) {
        options.push({
          text: t('variables.data-source-variable-slice.text.no-data-sources-found', 'No data sources found'),
          value: '',
          selected: false,
        });
      }

      if (instanceState.includeAll) {
        options.unshift({ text: ALL_VARIABLE_TEXT, value: ALL_VARIABLE_VALUE, selected: false });
      }

      instanceState.options = options;
    },
  },
});

function isValid(source: DataSourceInstanceSettings, regex?: RegExp) {
  if (!regex) {
    return true;
  }

  return regex.exec(source.name);
}

function isDefault(source: DataSourceInstanceSettings, regex?: RegExp) {
  if (!source.isDefault) {
    return false;
  }

  if (!regex) {
    return true;
  }

  return regex.exec('default');
}

export const dataSourceVariableReducer = dataSourceVariableSlice.reducer;
export const { createDataSourceOptions } = dataSourceVariableSlice.actions;
