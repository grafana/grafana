import { type SceneVariables, SceneVariableSet } from '@grafana/scenes';
import { type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

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
  const sceneVariables = variables.map((variable) => createSceneVariableFromVariableModel(variable));
  if (sceneVariables.length === 0) {
    return undefined;
  }

  const blockDependentsOnError = Boolean(config.featureToggles.dashboardVariablesBlockOnError);

  return new SceneVariableSet({
    variables: sceneVariables,
    blockDependentsOnError,
    // Most datasources (e.g. Prometheus label_values) swallow a failed request and resolve the
    // variable to an empty value rather than an error, so empty must be treated as an error for
    // the block-on-error behavior to cover the common failure case.
    treatEmptyAsError: blockDependentsOnError,
  });
}
