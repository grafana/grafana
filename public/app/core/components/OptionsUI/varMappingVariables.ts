import { useEffect, useReducer } from 'react';

import { type InterpolateFunction } from '@grafana/data';
import { getVariableSuggestions } from 'app/core/components/SuggestionsInput/getVariableSuggestions';

export interface VarMappingVariableValue {
  value: string;
  label: string;
}

export interface VarMappingVariable {
  name: string;
  /** The current value as shown in the variable control */
  current?: string;
  /** Every value the variable can take, when that is known without running a query */
  values?: VarMappingVariableValue[];
}

export interface NewVarMappingVariable {
  name: string;
  type: 'custom' | 'switch';
  values: VarMappingVariableValue[];
  current: string;
}

/**
 * The dashboard variables a `varMappings` editor can pick from, check against and add to. Kept
 * apart from the editor so `core` doesn't depend on the dashboard scene.
 */
export interface VarMappingVariableSource {
  getVariables(): VarMappingVariable[];
  interpolate: InterpolateFunction;
  /** Calls `onChange` when a variable value or the variable list changes; returns the unsubscribe */
  subscribe(onChange: () => void): () => void;
  /**
   * Adds the variable unless one with its name is already in scope, which is then used instead.
   * Returns whether a variable with the name is in scope afterwards.
   */
  createVariable?(variable: NewVarMappingVariable): boolean;
}

/** Variable names only, for editors rendered without a dashboard source */
export function getFallbackVarMappingVariables(): VarMappingVariable[] {
  return getVariableSuggestions().map((variable) => ({ name: variable.value }));
}

/** Re-renders the caller whenever the source reports a change */
export function useVarMappingVariableUpdates(source: VarMappingVariableSource | undefined) {
  const [, forceUpdate] = useReducer((count: number) => count + 1, 0);

  useEffect(() => source?.subscribe(forceUpdate), [source]);
}
