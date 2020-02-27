import { VariableModel, VariableType } from '../variable';
import { DataSourceSelectItem } from '@grafana/data';
import { TemplatingState } from './reducers';

export const emptyUuid = '00000000-0000-0000-0000-000000000000';

export interface VariableEditorState {
  name: string;
  type: VariableType;
  errors: Record<string, string>;
  isValid: boolean;
  dataSources: DataSourceSelectItem[];
}

export interface VariableEditorOnPropChange<Model extends VariableModel = VariableModel> {
  onPropChange: (propName: keyof Model, propValue: any) => void;
}

export interface VariableEditorProps<
  Model extends VariableModel = VariableModel,
  EditorState extends VariableEditorState = VariableEditorState
> extends VariableEditorOnPropChange<Model> {
  variable: Model;
  editor: EditorState;
  dataSources: DataSourceSelectItem[];
}

export interface VariablePickerProps<Model extends VariableModel = VariableModel, PickerState extends {} = {}> {
  variable: Model;
  picker: PickerState;
}

export const initialVariableEditorState: VariableEditorState = {
  name: '',
  type: 'query',
  errors: {},
  isValid: true,
  dataSources: [],
};

export interface VariableState<
  PickerState extends {} = {},
  EditorState extends VariableEditorState = VariableEditorState,
  ModelState extends VariableModel = VariableModel
> {
  picker: PickerState;
  editor: EditorState;
  variable: ModelState;
}

export const getInstanceState = <State extends VariableState = VariableState>(state: TemplatingState, uuid: string) => {
  return state.variables[uuid] as State;
};
