import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { map } from 'lodash';

import { IntervalVariableModel, VariableRefresh, VariableOption } from '@grafana/data';

import { getInstanceState } from '../state/selectors';
import { initialVariablesState, VariablePayload, VariablesState } from '../state/types';
import { initialVariableModelState } from '../types';

export const initialIntervalVariableModelState: IntervalVariableModel = {
  ...initialVariableModelState,
  type: 'interval',
  auto_count: 30,
  auto_min: '10s',
  options: [],
  auto: false,
  query: '1m,10m,30m,1h,6h,12h,1d,7d,14d,30d',
  refresh: VariableRefresh.onTimeRangeChanged,
  current: {},
};

export const intervalVariableSlice = createSlice({
  name: 'templating/interval',
  initialState: initialVariablesState,
  reducers: {
    createIntervalOptions: (state: VariablesState, action: PayloadAction<VariablePayload>) => {
      const instanceState = getInstanceState(state, action.payload.id);
      if (instanceState.type !== 'interval') {
        return;
      }
      const options: VariableOption[] = map(instanceState.query.match(/(["'])(.*?)\1|\w+/g), (text) => {
        text = text.replace(/["']+/g, '');
        return { text: text.trim(), value: text.trim(), selected: false };
      });

      if (instanceState.auto) {
        // add auto option if missing
        if (options.length && options[0].text !== 'auto') {
          options.unshift({
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
            text: 'auto',
            value: '$__auto_interval_' + instanceState.name,
            selected: false,
          });
        }
      }

      instanceState.options = options;
    },
  },
});

export const intervalVariableReducer = intervalVariableSlice.reducer;

export const { createIntervalOptions } = intervalVariableSlice.actions;
