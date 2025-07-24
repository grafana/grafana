import { cloneDeep } from 'lodash';

import { AdHocVariableModel } from '@grafana/data';
import { t } from '@grafana/i18n';

import { dispatch } from '../../../store/store';
import { VariableAdapter } from '../adapters';
import { toKeyedVariableIdentifier } from '../utils';

import { AdHocVariableEditor } from './AdHocVariableEditor';
import { setFiltersFromUrl } from './actions';
import { AdHocPicker } from './picker/AdHocPicker';
import { adHocVariableReducer, initialAdHocVariableModelState } from './reducer';
import * as urlParser from './urlParser';

const noop = async () => {};

export const createAdHocVariableAdapter = (): VariableAdapter<AdHocVariableModel> => {
  return {
    id: 'adhoc',
    description: t(
      'variables.create-ad-hoc-variable-adapter.description.add-keyvalue-filters-on-the-fly',
      'Add key/value filters on the fly.'
    ),
    name: 'Ad hoc filters',
    initialState: initialAdHocVariableModelState,
    reducer: adHocVariableReducer,
    picker: AdHocPicker,
    editor: AdHocVariableEditor,
    dependsOn: () => false,
    setValue: noop,
    setValueFromUrl: async (variable, urlValue) => {
      const filters = urlParser.toFilters(urlValue);
      await dispatch(setFiltersFromUrl(toKeyedVariableIdentifier(variable), filters));
    },
    updateOptions: noop,
    getSaveModel: (variable) => {
      const { index, id, state, global, rootStateKey, ...rest } = cloneDeep(variable);
      return rest;
    },
    getValueForUrl: (variable) => {
      const filters = variable?.filters ?? [];
      return urlParser.toUrl(filters);
    },
  };
};
