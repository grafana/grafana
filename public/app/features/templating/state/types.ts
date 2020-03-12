import { VariableModel, VariableType } from '../variable';
import { VariablesState } from './variablesReducer';

export const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';
export const ALL_VARIABLE_TEXT = 'All';
export const ALL_VARIABLE_VALUE = '$__all';
export const NONE_VARIABLE_TEXT = 'None';
export const NONE_VARIABLE_VALUE = '';

export const getInstanceState = <Model extends VariableModel = VariableModel>(state: VariablesState, uuid: string) => {
  return state[uuid] as Model;
};

export interface VariableIdentifier {
  type: VariableType;
  uuid: string;
}

export interface VariablePayload<T extends any = undefined> extends VariableIdentifier {
  data: T;
}

export interface AddVariable<T extends VariableModel = VariableModel> {
  global: boolean; // part of dashboard or global
  index: number; // the order in variables list
  model: T;
}

export const toVariableIdentifier = (variable: VariableModel): VariableIdentifier => {
  return { type: variable.type, uuid: variable.uuid! };
};

export function toVariablePayload<T extends any = undefined>(
  identifier: VariableIdentifier,
  data?: T
): VariablePayload<T>;
export function toVariablePayload<T extends any = undefined>(model: VariableModel, data?: T): VariablePayload<T>;
export function toVariablePayload<T extends any = undefined>(
  obj: VariableIdentifier | VariableModel,
  data?: T
): VariablePayload<T> {
  return { type: obj.type, uuid: obj.uuid!, data: data as T };
}
