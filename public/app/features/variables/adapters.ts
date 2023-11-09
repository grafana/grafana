import { ComponentType } from 'react';
import { Reducer } from 'redux';

import { Registry, TypedVariableModel, UrlQueryValue, VariableOption, VariableType } from '@grafana/data';

import { VariableEditorProps } from './editor/types';
import { VariablePickerProps } from './pickers/types';
import { VariablesState } from './state/types';

export interface VariableAdapter<Model extends TypedVariableModel> {
  id: VariableType;
  description: string;
  name: string;
  initialState: Model;
  dependsOn: (variable: Model, variableToTest: Model) => boolean;
  setValue: (variable: Model, option: VariableOption, emitChanges?: boolean) => Promise<void>;
  setValueFromUrl: (variable: Model, urlValue: UrlQueryValue) => Promise<void>;
  updateOptions: (variable: Model, searchFilter?: string) => Promise<void>;
  getSaveModel: (variable: Model, saveCurrentAsDefault?: boolean) => Partial<Model>;
  getValueForUrl: (variable: Model) => string | string[];
  picker: ComponentType<VariablePickerProps<Model>>;
  editor: ComponentType<VariableEditorProps<Model>>;
  reducer: Reducer<VariablesState>;
  beforeAdding?: (model: any) => any;
}

export const variableAdapters = new Registry<VariableAdapter<any>>();
