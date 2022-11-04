import { Observable } from 'rxjs';

import { LoadingState, SelectableValue } from '@grafana/data';
import { VariableHide } from 'app/features/variables/types';

import { SceneObject, SceneObjectStatePlain } from '../core/types';

export interface SceneVariableState extends SceneObjectStatePlain {
  name: string;
  label?: string;
  hide?: VariableHide;
  skipUrlSync?: boolean;
  state?: LoadingState;
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
  getValueOptions(args: VariableGetOptionsArgs): Observable<VariableValueOption[]>;
}

export type VariableValueOption = SelectableValue<string>;
export interface VariableGetOptionsArgs {
  searchFilter?: string;
}

export interface SceneVariableSetState extends SceneObjectStatePlain {
  variables: SceneVariable[];
}

export interface SceneVariables extends SceneObject<SceneVariableSetState> {
  getByName(name: string): SceneVariable | undefined;
}
