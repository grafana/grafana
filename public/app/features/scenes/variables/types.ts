import { Observable } from 'rxjs';

import { VariableHide } from 'app/features/variables/types';

import { SceneObject, SceneObjectStatePlain } from '../core/types';

export interface SceneVariableState extends SceneObjectStatePlain {
  name: string;
  label?: string;
  hide?: VariableHide;
  skipUrlSync?: boolean;
  loading?: boolean;
  error?: any | null;
  description?: string | null;
  text: string | string[]; // old current.text
  value: string | string[]; // old current.value
}

export interface SceneVariable<TState extends SceneVariableState = SceneVariableState> extends SceneObject<TState> {
  /**
   * Should return a string array of other variables this variable is using in it's definition.
   */
  getDependencies?(): string[];

  /**
   * This function is called when variable should execute it's query (if it's a query variable) and re-evaluate whether the
   * current value is valid and if not update it's current value.
   */
  //getValueOptions(args: VariableGetOptionsArgs): Observable<VariableValueOption[]>;

  /**
   * This function is called on activation or when a dependency changes.
   */
  validateAndUpdate?(): Observable<ValidateAndUpdateResult>;
}

export interface ValidateAndUpdateResult {}

export interface VariableValueOption {
  label: string;
  value: string;
}

export interface SceneVariableSetState extends SceneObjectStatePlain {
  variables: SceneVariable[];
}

export interface SceneVariables extends SceneObject<SceneVariableSetState> {
  getByName(name: string): SceneVariable | undefined;
}
