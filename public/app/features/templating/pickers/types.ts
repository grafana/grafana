import { VariableModel } from '../variable';

export interface VariablePickerProps<Model extends VariableModel = VariableModel> {
  variable: Model;
}
