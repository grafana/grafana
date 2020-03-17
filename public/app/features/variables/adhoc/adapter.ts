import cloneDeep from 'lodash/cloneDeep';
import { AdHocVariableModel } from '../../templating/variable';
import { dispatch } from '../../../store/store';
import { setOptionFromUrl } from '../state/actions';
import { VariableAdapter } from '../adapters';
import { AdHocPicker } from '../pickers';
import { toVariableIdentifier } from '../state/types';
import { adHocVariableReducer, initialAdHocVariableModelState } from './reducer';
import { AdHocVariableEditor } from './AdHocVariableEditor';

export const createAdHocVariableAdapter = (): VariableAdapter<AdHocVariableModel> => {
  return {
    description: 'Add key/value filters on the fly',
    label: 'Ad hoc filters',
    initialState: initialAdHocVariableModelState,
    reducer: adHocVariableReducer,
    picker: AdHocPicker,
    editor: AdHocVariableEditor,
    dependsOn: () => {
      return false;
    },
    setValue: async (variable, option, emitChanges = false) => {},
    setValueFromUrl: async (variable, urlValue) => {
      await dispatch(setOptionFromUrl(toVariableIdentifier(variable), urlValue));
    },
    updateOptions: async variable => {},
    getSaveModel: variable => {
      const { index, uuid, initLock, global, ...rest } = cloneDeep(variable);
      return rest;
    },
    getValueForUrl: variable => {
      return null; //variable.current.value;
    },
  };
};
