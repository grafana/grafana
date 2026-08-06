import { changeDescription } from './dashboard/changeDescription';
import { changeTitle } from './dashboard/changeTitle';
import { addElement } from './element/addElement';
import { moveElement } from './element/moveElement';
import { removeElement } from './element/removeElement';
import { edit } from './utils/edit';
import { addVariable } from './variable/addVariable';
import { changeVariableDescription } from './variable/changeVariableDescription';
import { changeVariableHideValue } from './variable/changeVariableHideValue';
import { changeVariableLabel } from './variable/changeVariableLabel';
import { changeVariableName } from './variable/changeVariableName';
import { changeVariableType } from './variable/changeVariableType';
import { removeVariable } from './variable/removeVariable';

export const dashboardEditActions = {
  edit,
  addElement,
  removeElement,
  moveElement,
  changeTitle,
  changeDescription,
  addVariable,
  removeVariable,
  changeVariableType,
  changeVariableName,
  changeVariableLabel,
  changeVariableDescription,
  changeVariableHideValue,
};
