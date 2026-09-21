import { config } from '@grafana/runtime';
import { type SceneVariable, type SceneVariables, SceneVariableSet } from '@grafana/scenes';
import { defaultGroupByVariableKind, type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { sceneVariablesSetToSchemaV2Variables } from '../sceneVariablesSetToVariables';
import { createSceneVariableFromVariableModel } from '../transformSaveModelSchemaV2ToScene';

export function serializeSectionVariables(variableSet?: SceneVariables): VariableKind[] | undefined {
  if (!variableSet) {
    return undefined;
  }

  const variables = sceneVariablesSetToSchemaV2Variables(variableSet);
  return variables.length > 0 ? variables : undefined;
}

export function deserializeSectionVariables(variables?: VariableKind[]): SceneVariableSet | undefined {
  if (!variables || variables.length === 0) {
    return undefined;
  }

  // VariableKind is structurally identical to TypedVariableModelV2
  const sceneVariables = variables
    .map((variable) => {
      // groupByVariable is still experimental. skip the control when the flag is off so
      // section-scoped dashboards keep loading instead of throwing (see #132312).
      if (variable.kind === defaultGroupByVariableKind().kind && !config.featureToggles.groupByVariable) {
        return null;
      }

      try {
        return createSceneVariableFromVariableModel(variable);
      } catch (err) {
        console.error(err);
        return null;
      }
    })
    .filter((v): v is SceneVariable => Boolean(v));

  if (sceneVariables.length === 0) {
    return undefined;
  }

  return new SceneVariableSet({ variables: sceneVariables });
}
