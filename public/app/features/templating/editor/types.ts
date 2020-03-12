import { VariableModel } from '../variable';

export interface OnPropChangeArguments<Model extends VariableModel = VariableModel> {
  propName: keyof Model;
  propValue: any;
  updateOptions?: boolean;
}

export interface VariableEditorProps<Model extends VariableModel = VariableModel> {
  variable: Model;
  onPropChange: (args: OnPropChangeArguments<Model>) => void;
}
