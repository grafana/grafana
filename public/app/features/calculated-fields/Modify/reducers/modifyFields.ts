import { DEFAULT_CALC_FIELD } from '../../constants';
import { SearchAction, CalcFields } from '../../types';

import {
  LOAD_START,
  LOAD_END,
  UPDATE_FORMS,
  UPDATE_FIELDS,
  UPDATE_MODULES,
  UPDATE_ERR_MSG,
  UPDATE_COLUMNS,
} from './actionTypes';

export interface ModifyFieldsState {
  forms: string[];
  columns: string[];
  modules: string[];
  loading: boolean;
  errMsg?: string;
  fields: CalcFields;
}

export const modifyFieldsState: ModifyFieldsState = {
  loading: true,
  forms: [],
  columns: [],
  modules: [],
  errMsg: '',
  fields: DEFAULT_CALC_FIELD,
};

export const modifyReducer = (state: ModifyFieldsState, action: SearchAction) => {
  switch (action.type) {
    case LOAD_START:
      if (!state.loading) {
        return { ...state, loading: true };
      }
      return state;
    case LOAD_END: {
      return { ...state, loading: false };
    }
    case UPDATE_ERR_MSG: {
      return { ...state, errMsg: action.payload, loading: false };
    }
    case UPDATE_FORMS: {
      return { ...state, forms: action.payload || [] };
    }
    case UPDATE_FIELDS: {
      return { ...state, fields: { ...state.fields, ...action.payload }, loading: false };
    }
    case UPDATE_MODULES: {
      return { ...state, modules: action.payload || [] };
    }
    case UPDATE_COLUMNS: {
      return { ...state, columns: action.payload || [] };
    }
    default:
      return state;
  }
};
