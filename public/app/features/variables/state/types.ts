import { VariableType, TypedVariableModel, BaseVariableModel } from '@grafana/data';

export type VariablesState = Record<string, TypedVariableModel>;

export const initialVariablesState: VariablesState = {};

export interface VariableIdentifier {
  type: VariableType;
  id: string;
}

export interface KeyedVariableIdentifier {
  type: VariableType;
  id: string;
  rootStateKey: string;
}

export interface VariablePayload<T = undefined> extends VariableIdentifier {
  data: T;
}

export interface AddVariable<T extends BaseVariableModel = BaseVariableModel> {
  global: boolean; // part of dashboard or global
  index: number; // the order in variables list
  model: T;
}
