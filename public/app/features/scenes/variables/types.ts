import { Observable } from 'rxjs';

import { BusEventWithPayload } from '@grafana/data';
import { VariableType } from '@grafana/schema';
import { VariableHide } from 'app/features/variables/types';

import { SceneObject, SceneObjectStatePlain } from '../core/types';

export interface SceneVariableState extends SceneObjectStatePlain {
  type: VariableType;
  name: string;
  label?: string;
  hide?: VariableHide;
  skipUrlSync?: boolean;
  loading?: boolean;
  error?: any | null;
  description?: string | null;
}

export interface SceneVariable<TState extends SceneVariableState = SceneVariableState> extends SceneObject<TState> {
  /**
   * This function is called on activation or when a dependency changes.
   */
  validateAndUpdate?(): Observable<ValidateAndUpdateResult>;

  /**
   * Should return the value for the given field path
   */
  getValue(fieldPath?: string): VariableValue | undefined | null;

  /**
   * Should return the value display text, used by the "text" formatter
   * Example: ${podId:text}
   * Useful for variables that have non user friendly values but friendly display text names.
   */
  getValueText?(fieldPath?: string): string;
}

export type VariableValue = VariableValueSingle | VariableValueSingle[];

export type VariableValueSingle = string | boolean | number;

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

export class SceneVariableValueChangedEvent extends BusEventWithPayload<SceneVariable> {
  public static type = 'scene-variable-changed-value';
}

export interface SceneVariableDependencyConfigLike {
  /** Return all variable names this object depend on */
  getNames(): Set<string>;

  /** Used to check for dependency on a specific variable */
  hasDependencyOn(name: string): boolean;

  /**
   * Will be called when any variable value has changed.
   **/
  variableValuesChanged(variables: Set<SceneVariable>): void;
}
