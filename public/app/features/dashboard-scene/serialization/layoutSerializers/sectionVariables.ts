import { type SceneVariables, SceneVariableSet } from '@grafana/scenes';
import { type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { migrateGroupByVariablesV2 } from '../groupByMigration';
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

  // Scenes suffixes a section variable's URL key (var-adhoc-2) when its name collides with another
  // variable, and that can't be resolved before the scene is built, so leave the URL alone here.
  const migrated = migrateGroupByVariablesV2(variables, { migrateUrlState: false });
  // VariableKind is structurally identical to TypedVariableModelV2
  const sceneVariables = migrated.map((variable) => createSceneVariableFromVariableModel(variable));
  if (sceneVariables.length === 0) {
    return undefined;
  }

  return new SceneVariableSet({ variables: sceneVariables });
}
