import { cloneDeep } from 'lodash';

import { dispatch } from '../../../store/store';
import { VariableAdapter } from '../adapters';
import { optionPickerFactory } from '../pickers';
import { setOptionAsCurrent, setOptionFromUrl } from '../state/actions';
import { IntervalVariableModel } from '../types';
import { toKeyedVariableIdentifier } from '../utils';

import { IntervalVariableEditor } from './IntervalVariableEditor';
import { updateAutoValue, updateIntervalVariableOptions } from './actions';
import { initialIntervalVariableModelState, intervalVariableReducer } from './reducer';

export const createIntervalVariableAdapter = (): VariableAdapter<IntervalVariableModel> => {
  return {
    id: 'interval',
    description: 'Define a timespan interval (ex 1m, 1h, 1d)',
    name: 'Interval',
    initialState: initialIntervalVariableModelState,
    reducer: intervalVariableReducer,
    picker: optionPickerFactory<IntervalVariableModel>(),
    editor: IntervalVariableEditor,
    dependsOn: () => {
      return false;
    },
    setValue: async (variable, option, emitChanges = false) => {
      await dispatch(updateAutoValue(toKeyedVariableIdentifier(variable)));
      await dispatch(setOptionAsCurrent(toKeyedVariableIdentifier(variable), option, emitChanges));
    },
    setValueFromUrl: async (variable, urlValue) => {
      await dispatch(updateAutoValue(toKeyedVariableIdentifier(variable)));
      await dispatch(setOptionFromUrl(toKeyedVariableIdentifier(variable), urlValue));
    },
    updateOptions: async (variable) => {
      await dispatch(updateIntervalVariableOptions(toKeyedVariableIdentifier(variable)));
    },
    getSaveModel: (variable) => {
      const { index, id, state, global, rootStateKey, ...rest } = cloneDeep(variable);
      return rest;
    },
    getValueForUrl: (variable) => {
      return variable.current.value;
    },
  };
};
