import { ComponentType } from 'react';
import { Reducer } from 'redux';
import { Registry, UrlQueryValue, VariableType } from '@grafana/data';

import {
  AdHocVariableModel,
  ConstantVariableModel,
  CustomVariableModel,
  DataSourceVariableModel,
  IntervalVariableModel,
  QueryVariableModel,
  TextBoxVariableModel,
  VariableModel,
  VariableOption,
} from '../templating/types';
import { VariableEditorProps } from './editor/types';
import { VariablesState } from './state/variablesReducer';
import { VariablePickerProps } from './pickers/types';
import { createQueryVariableAdapter } from './query/adapter';
import { createCustomVariableAdapter } from './custom/adapter';
import { createTextBoxVariableAdapter } from './textbox/adapter';
import { createConstantVariableAdapter } from './constant/adapter';
import { createDataSourceVariableAdapter } from './datasource/adapter';
import { createIntervalVariableAdapter } from './interval/adapter';
import { createAdHocVariableAdapter } from './adhoc/adapter';

export interface VariableAdapter<Model extends VariableModel> {
  id: VariableType;
  description: string;
  name: string;
  initialState: Model;
  dependsOn: (variable: Model, variableToTest: Model) => boolean;
  setValue: (variable: Model, option: VariableOption, emitChanges?: boolean) => Promise<void>;
  setValueFromUrl: (variable: Model, urlValue: UrlQueryValue) => Promise<void>;
  updateOptions: (variable: Model, searchFilter?: string) => Promise<void>;
  getSaveModel: (variable: Model) => Partial<Model>;
  getValueForUrl: (variable: Model) => string | string[];
  picker: ComponentType<VariablePickerProps>;
  editor: ComponentType<VariableEditorProps>;
  reducer: Reducer<VariablesState>;
}

export type VariableModels =
  | QueryVariableModel
  | CustomVariableModel
  | TextBoxVariableModel
  | ConstantVariableModel
  | DataSourceVariableModel
  | IntervalVariableModel
  | AdHocVariableModel;
export type VariableTypeRegistry<Model extends VariableModel = VariableModel> = Registry<VariableAdapter<Model>>;

export const getDefaultVariableAdapters = () => [
  createQueryVariableAdapter(),
  createCustomVariableAdapter(),
  createTextBoxVariableAdapter(),
  createConstantVariableAdapter(),
  createDataSourceVariableAdapter(),
  createIntervalVariableAdapter(),
  createAdHocVariableAdapter(),
];

export const variableAdapters: VariableTypeRegistry = new Registry<VariableAdapter<VariableModels>>();
