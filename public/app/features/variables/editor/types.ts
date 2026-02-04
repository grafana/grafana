import { BaseVariableModel } from '@grafana/data';

export enum VariableNameConstraints {
  MaxSize = 50,
}

export interface OnPropChangeArguments<Model extends BaseVariableModel = BaseVariableModel> {
  propName: keyof Model;
  propValue: unknown;
  updateOptions?: boolean;
}

export interface VariableEditorProps<Model extends BaseVariableModel = BaseVariableModel> {
  variable: Model;
  onPropChange: (args: OnPropChangeArguments<Model>) => void;
}
