import cloneDeep from 'lodash/cloneDeep';

import { TextBoxVariableModel } from '../variable';
import { initialTextBoxVariableModelState, textBoxVariableReducer } from './reducer';
import { dispatch } from '../../../store/store';
import { setOptionAsCurrent, setOptionFromUrl } from '../state/actions';
import { VariableAdapter } from '../adapters';
import { TextBoxVariablePicker } from './TextBoxVariablePicker';
import { TextBoxVariableEditor } from './TextBoxVariableEditor';
import { updateTextBoxVariableOptions } from './actions';
import { toVariableIdentifier } from '../state/types';

export const createTextBoxVariableAdapter = (): VariableAdapter<TextBoxVariableModel> => {
  return {
    description: 'Define a textbox variable, where users can enter any arbitrary string',
    label: 'Text box',
    initialState: initialTextBoxVariableModelState,
    reducer: textBoxVariableReducer,
    picker: TextBoxVariablePicker,
    editor: TextBoxVariableEditor,
    dependsOn: (variable, variableToTest) => {
      return false;
    },
    setValue: async (variable, option, emitChanges = false) => {
      await dispatch(setOptionAsCurrent(toVariableIdentifier(variable), option, emitChanges));
    },
    setValueFromUrl: async (variable, urlValue) => {
      await dispatch(setOptionFromUrl(toVariableIdentifier(variable), urlValue));
    },
    updateOptions: async variable => {
      await dispatch(updateTextBoxVariableOptions(toVariableIdentifier(variable)));
    },
    getSaveModel: variable => {
      const { index, uuid, initLock, global, ...rest } = cloneDeep(variable);
      return rest;
    },
    getValueForUrl: variable => {
      return variable.current.value;
    },
  };
};
