import { SceneObjectBase } from '../../core/SceneObjectBase';
import { SceneVariable, SceneVariableState, VariableValue } from '../types';

export interface ConstantVariableState extends SceneVariableState {
  value: string;
}

export class ConstantVariable
  extends SceneObjectBase<ConstantVariableState>
  implements SceneVariable<ConstantVariableState>
{
  public getValue(): VariableValue {
    return this.state.value;
  }
}
