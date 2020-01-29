import { VariableModel } from '../variable';

export interface VariableEditorState {
  name: string;
  errors: Record<string, string>;
  valid: boolean;
}

export const initialVariableEditorState: VariableEditorState = {
  name: '',
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
