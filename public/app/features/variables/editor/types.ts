import { VariableModel } from '../types';

export enum VariableNameConstraints {
  MaxSize = 50,
}

export interface OnPropChangeArguments<Model extends VariableModel = VariableModel> {
  propName: keyof Model;
  propValue: unknown;
  updateOptions?: boolean;
}

export interface VariableEditorProps<Model extends VariableModel = VariableModel> {
  variable: Model;
  onPropChange: (args: OnPropChangeArguments<Model>) => void;
}
