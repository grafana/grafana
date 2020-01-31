import { VariableModel, VariableType } from '../variable';
import { DataSourceSelectItem } from '@grafana/data';

export interface VariableEditorState {
  name: string;
  type: VariableType;
  errors: Record<string, string>;
  isValid: boolean;
  dataSources: DataSourceSelectItem[];
}

export interface VariableEditorProps<
  Model extends VariableModel = VariableModel,
  EditorState extends VariableEditorState = VariableEditorState
> {
  variable: Model;
  editor: EditorState;
  dataSources: DataSourceSelectItem[];
  onPropChange: (propName: keyof Model, propValue: any) => void;
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
