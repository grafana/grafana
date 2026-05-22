/**
 * Shared variable utilities for mutation commands.
 *
 * Contains helpers used across add/remove/update variable commands.
 */

import { sceneUtils, SceneVariableSet, type SceneVariable, type sceneGraph } from '@grafana/scenes';
import {
  defaultVariableHide,
  type CustomVariableKind,
  type QueryVariableKind,
  type TextVariableKind,
  type VariableKind,
  type VariableOption,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';

/**
 * Replace the dashboard's variable set with a new set containing the given variables.
 * This ensures consistent lifecycle behavior across add/remove/update operations.
 */
export function replaceVariableSet(
  scene: Parameters<typeof sceneGraph.getVariables>[0],
  variables: ReturnType<typeof sceneGraph.getVariables>['state']['variables']
): SceneVariableSet {
  const newVarSet = new SceneVariableSet({ variables });
  scene.setState({ $variables: newVarSet });
  newVarSet.activate();
  return newVarSet;
}

/**
 * Convert a SceneVariable instance back to a v2beta1 VariableKind.
 *
 * POC-scope implementation: handles QueryVariable, CustomVariable, and
 * TextBoxVariable (the types the variable editor produces by default in
 * the canonical undo demo). Other types throw; full implementation is on
 * the Proposal 1 branch (feat/mutation-api-variable-ui-pilot) and should
 * be ported wholesale when this architecture moves out of POC.
 */
export function createVariableKindFromSceneVariable(variable: SceneVariable): VariableKind {
  const commonProperties = {
    name: variable.state.name,
    label: variable.state.label,
    description: variable.state.description ?? undefined,
    skipUrlSync: Boolean(variable.state.skipUrlSync),
    hide: defaultVariableHide(),
  };

  // @ts-expect-error -- SceneVariable value/text not typed on base state
  const currentVariableOption: VariableOption = { value: variable.state.value, text: variable.state.text };

  if (sceneUtils.isQueryVariable(variable)) {
    const result: QueryVariableKind = {
      kind: 'QueryVariable',
      spec: {
        ...commonProperties,
        current: currentVariableOption,
        options: [],
        query: { kind: 'DataQuery', spec: {}, group: 'prometheus', version: 'v0' },
        definition: variable.state.definition ?? '',
        sort: 'disabled',
        refresh: 'never',
        regex: variable.state.regex ?? '',
        includeAll: variable.state.includeAll || false,
        multi: variable.state.isMulti || false,
        allowCustomValue: variable.state.allowCustomValue ?? true,
      },
    };
    return result;
  }

  if (sceneUtils.isCustomVariable(variable)) {
    const result: CustomVariableKind = {
      kind: 'CustomVariable',
      spec: {
        ...commonProperties,
        current: currentVariableOption,
        options: [],
        query: variable.state.query,
        multi: variable.state.isMulti || false,
        allValue: variable.state.allValue,
        includeAll: variable.state.includeAll ?? false,
        allowCustomValue: variable.state.allowCustomValue ?? true,
        valuesFormat: variable.state.valuesFormat ?? 'csv',
      },
    };
    return result;
  }

  if (sceneUtils.isTextBoxVariable(variable)) {
    const value = variable.state.value ?? '';
    const result: TextVariableKind = {
      kind: 'TextVariable',
      spec: {
        ...commonProperties,
        current: { text: value, value },
        query: value,
      },
    };
    return result;
  }

  throw new Error(
    `createVariableKindFromSceneVariable: unsupported variable type '${variable.state.type}' (POC scope)`
  );
}
