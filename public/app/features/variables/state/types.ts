import { VariableType } from '@grafana/data';

import { VariableModel } from '../types';

export interface VariablesState extends Record<string, VariableModel> {}

export const initialVariablesState: VariablesState = {};

export const getInstanceState = <Model extends VariableModel = VariableModel>(state: VariablesState, id: string) => {
  return state[id] as Model;
};

export interface VariableIdentifier {
  type: VariableType;
  id: string;
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
  return { type: variable.type, id: variable.id };
};

export function toVariablePayload<T extends any = undefined>(
  identifier: VariableIdentifier,
  data?: T
): VariablePayload<T>;
// eslint-disable-next-line
export function toVariablePayload<T extends any = undefined>(model: VariableModel, data?: T): VariablePayload<T>;
// eslint-disable-next-line
export function toVariablePayload<T extends any = undefined>(
  obj: VariableIdentifier | VariableModel,
  data?: T
): VariablePayload<T> {
  return { type: obj.type, id: obj.id, data: data as T };
}
