import { VariableModel } from '../types';

export interface VariablePickerProps<Model extends VariableModel = VariableModel> {
  variable: Model;
  readOnly: boolean;
  onVariableChange?: (variable: Model) => void;
}

export enum NavigationKey {
  moveUp = 38,
  moveDown = 40,
  select = 32,
  cancel = 27,
  selectAndClose = 13,
}
