import { BaseVariableModel } from '@grafana/data';

export interface VariablePickerProps<Model extends BaseVariableModel = BaseVariableModel> {
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
