import { TypedVariableModel, VariableType } from '@grafana/data';

// Keyed by variable name
export interface VariablesState extends Record<string, TypedVariableModel> {}

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

// TODO: this type is not yet 100% - it'll alow mismatched name/value
// interface VariablePayloadData<TName extends keyof TypedVariableModel = keyof TypedVariableModel> {
//   propName: TName;
//   propValue: TypedVariableModel[TName];
// }

export interface VariablePayload<T extends any = undefined> extends VariableIdentifier {
  data: T;
}

export interface AddVariable {
  global: boolean; // part of dashboard or global
  index: number; // the order in variables list
  model: TypedVariableModel;
}
