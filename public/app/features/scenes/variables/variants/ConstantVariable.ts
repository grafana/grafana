import { SceneObjectBase } from '../../core/SceneObjectBase';
import { SceneVariable, SceneVariableState } from '../types';

export interface ConstantVariableState extends SceneVariableState {}

export class ConstantVariable
  extends SceneObjectBase<ConstantVariableState>
  implements SceneVariable<ConstantVariableState> {}
