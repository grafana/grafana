import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { IntervalVariableModel, VariableHide, VariableOption, VariableRefresh } from '../../templating/types';
import { getInstanceState, NEW_VARIABLE_ID, VariablePayload } from '../state/types';
import { initialVariablesState, VariablesState } from '../state/variablesReducer';
import _ from 'lodash';

export const initialIntervalVariableModelState: IntervalVariableModel = {
  id: NEW_VARIABLE_ID,
  global: false,
  type: 'interval',
  name: '',
  label: '',
  hide: VariableHide.dontHide,
  skipUrlSync: false,
  auto_count: 30,
  auto_min: '10s',
  options: [],
  auto: false,
  query: '1m,10m,30m,1h,6h,12h,1d,7d,14d,30d',
  refresh: VariableRefresh.onTimeRangeChanged,
  current: {} as VariableOption,
  index: -1,
  initLock: null,
};

export const intervalVariableSlice = createSlice({
  name: 'templating/interval',
  initialState: initialVariablesState,
  reducers: {
    createIntervalOptions: (state: VariablesState, action: PayloadAction<VariablePayload>) => {
      const instanceState = getInstanceState<IntervalVariableModel>(state, action.payload.id!);
      const options: VariableOption[] = _.map(instanceState.query.match(/(["'])(.*?)\1|\w+/g), text => {
        text = text.replace(/["']+/g, '');
        return { text: text.trim(), value: text.trim(), selected: false };
      });

      if (instanceState.auto) {
        // add auto option if missing
        if (options.length && options[0].text !== 'auto') {
          options.unshift({
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
