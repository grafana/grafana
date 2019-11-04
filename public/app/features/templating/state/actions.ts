import { VariableModel } from '../variable';
import { actionCreatorFactory } from '../../../core/redux';

export interface CreateVariable<T extends VariableModel = VariableModel> {
  model: T;
  defaults: T;
}

export const createVariable = actionCreatorFactory<CreateVariable>('CORE_TEMPLATING_CREATE_VARIABLE').create();

export interface UpdateVariableProp<T> {
  id: number;
  propName: string;
  value: T;
}

export const updateVariableProp = actionCreatorFactory<UpdateVariableProp<any>>(
  'CORE_TEMPLATING_UPDATE_VARIABLE_PROP'
).create();
