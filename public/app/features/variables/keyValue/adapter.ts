import { dispatch } from 'app/store/store';

import { VariableAdapter } from '../adapters';
import { setOptionAsCurrent } from '../state/actions';
import { KeyValueVariableModel } from '../types';
import { toKeyedVariableIdentifier } from '../utils';

import { KeyValueVariablePicker } from './KeyValueVariablePicker';
import { removeKeyValueVariable } from './actions';
import { constantVariableReducer, initialKeyValueVariableModelState } from './reducer';

const noop = async () => {};

export const createKeyValueVariableAdapter = (): VariableAdapter<KeyValueVariableModel> => {
  return {
    id: 'keyValue',
    description: '',
    name: 'Key Value',
    initialState: initialKeyValueVariableModelState,
    reducer: constantVariableReducer,
    picker: KeyValueVariablePicker,
    editor: () => null,
    dependsOn: () => {
      return false;
    },
    setValue: async (variable, option, emitChanges = true) => {
      await dispatch(setOptionAsCurrent(toKeyedVariableIdentifier(variable), option, emitChanges));
    },
    setValueFromUrl: async (variable, urlValue) => {
      if (urlValue === '' || !urlValue) {
        await dispatch(removeKeyValueVariable(toKeyedVariableIdentifier(variable)));
      } else {
        await dispatch(
          setOptionAsCurrent(
            toKeyedVariableIdentifier(variable),
            { selected: true, text: urlValue.toString(), value: urlValue.toString() },
            true
          )
        );
      }
    },
    updateOptions: noop,
    getValueForUrl: (variable) => {
      return variable.current.value || '';
    },
  };
};
