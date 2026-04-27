import { type ComponentType } from 'react';
import { type Reducer } from 'redux';

import type { TypedVariableModel, VariableOption, VariableType } from '@grafana/data/types';
import { Registry, type UrlQueryValue } from '@grafana/data/utils';

import { type VariableEditorProps } from './editor/types';
import { type VariablePickerProps } from './pickers/types';
import { type VariablesState } from './state/types';

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
