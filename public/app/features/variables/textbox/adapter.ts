import { cloneDeep } from 'lodash';

import { TextBoxVariableModel } from '../types';
import { initialTextBoxVariableModelState, textBoxVariableReducer } from './reducer';
import { dispatch } from '../../../store/store';
import { setOptionAsCurrent } from '../state/actions';
import { VariableAdapter } from '../adapters';
import { TextBoxVariablePicker } from './TextBoxVariablePicker';
import { TextBoxVariableEditor } from './TextBoxVariableEditor';
import { setTextBoxVariableOptionsFromUrl, updateTextBoxVariableOptions } from './actions';
import { toKeyedVariableIdentifier } from '../utils';

export const createTextBoxVariableAdapter = (): VariableAdapter<TextBoxVariableModel> => {
  return {
    id: 'textbox',
    description: 'Define a textbox variable, where users can enter any arbitrary string',
    name: 'Text box',
    initialState: initialTextBoxVariableModelState,
    reducer: textBoxVariableReducer,
    picker: TextBoxVariablePicker,
    editor: TextBoxVariableEditor,
    dependsOn: (variable, variableToTest) => {
      return false;
    },
    setValue: async (variable, option, emitChanges = false) => {
      await dispatch(setOptionAsCurrent(toKeyedVariableIdentifier(variable), option, emitChanges));
    },
    setValueFromUrl: async (variable, urlValue) => {
      await dispatch(setTextBoxVariableOptionsFromUrl(toKeyedVariableIdentifier(variable), urlValue));
    },
    updateOptions: async (variable) => {
      await dispatch(updateTextBoxVariableOptions(toKeyedVariableIdentifier(variable)));
    },
    getSaveModel: (variable, saveCurrentAsDefault) => {
      const { index, id, state, global, originalQuery, rootStateKey, ...rest } = cloneDeep(variable);

      if (variable.query !== originalQuery && !saveCurrentAsDefault) {
        const origQuery = originalQuery ?? '';
        const current = { selected: false, text: origQuery, value: origQuery };
        return { ...rest, query: origQuery, current, options: [current] };
      }

      return rest;
    },
    getValueForUrl: (variable) => {
      return variable.current.value;
    },
    beforeAdding: (model) => {
      return { ...cloneDeep(model), originalQuery: model.query };
    },
  };
};
