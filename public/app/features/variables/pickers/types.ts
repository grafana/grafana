import { VariableModel } from '../types';

export interface VariablePickerProps<Model extends VariableModel = VariableModel> {
  variable: Model;
  /**
   *  Id used to relate input to the label
   */
  id: string;
  onVariableChange?: (variable: Model) => void;
}

export enum NavigationKey {
  moveUp = 38,
  moveDown = 40,
  select = 32,
  cancel = 27,
  selectAndClose = 13,
}
