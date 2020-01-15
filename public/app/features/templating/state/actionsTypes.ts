import { VariableModel } from '../variable';

export interface CreateVariable<T extends VariableModel = VariableModel> {
  model: T;
  defaults: T;
}

export interface UpdateVariableProp<T> {
  id: number;
  propName: string;
  value: T;
}

export interface RemoveVariable {
  id: number;
}

export interface ChangeVariableType<T extends VariableModel = VariableModel> {
  id: number;
  defaults: T;
}
