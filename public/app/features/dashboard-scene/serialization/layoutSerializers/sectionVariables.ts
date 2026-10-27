import { type SceneVariables, SceneVariableSet } from '@grafana/scenes';
import { type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { sceneVariablesSetToSchemaV2Variables } from '../sceneVariablesSetToVariables';
import { createSceneVariablesFromVariableKinds } from '../transformSaveModelSchemaV2ToScene';

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

  const sceneVariables = createSceneVariablesFromVariableKinds(variables, { migrateUrlState: false });
  if (sceneVariables.length === 0) {
    return undefined;
  }

  return new SceneVariableSet({ variables: sceneVariables });
}
