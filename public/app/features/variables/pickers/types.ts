import { VariableModel } from '../../templating/types';

export interface VariablePickerProps<Model extends VariableModel = VariableModel> {
  variable: Model;
}

export enum NavigationKey {
  moveUp = 38,
  moveDown = 40,
  select = 32,
  cancel = 27,
  selectAndClose = 13,
}
