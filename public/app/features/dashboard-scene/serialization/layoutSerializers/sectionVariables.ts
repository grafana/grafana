import { SceneVariables, SceneVariableSet } from '@grafana/scenes';
import { VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { sceneVariablesSetToSchemaV2Variables } from '../sceneVariablesSetToVariables';
import { createSceneVariableFromVariableModel } from '../transformSaveModelSchemaV2ToScene';

export function serializeSectionVariables(variableSet?: SceneVariables): VariableKind[] | undefined {
  if (!variableSet) {
    return undefined;
  }

  const variables = sceneVariablesSetToSchemaV2Variables(variableSet);
  return variables.length > 0 ? variables : undefined;
}

export function createSectionVariables(variables?: VariableKind[]): SceneVariableSet | undefined {
  if (!variables || variables.length === 0) {
    return undefined;
  }

  // VariableKind is structurally identical to TypedVariableModelV2
  const sceneVariables = variables.map((variable) => createSceneVariableFromVariableModel(variable));

  if (sceneVariables.length === 0) {
    return undefined;
  }

  return new SceneVariableSet({ variables: sceneVariables });
}
