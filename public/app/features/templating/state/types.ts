import { VariableModel, VariableType } from '../variable';

export interface VariableEditorState {
  name: string;
  type: VariableType;
  errors: Record<string, string>;
  valid: boolean;
}

export const initialVariableEditorState: VariableEditorState = {
  name: '',
  type: 'query',
  errors: {},
  valid: false,
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
