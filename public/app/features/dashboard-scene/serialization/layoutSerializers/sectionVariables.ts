import { config } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
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
  // OpenFeature is not initialized for anonymous users, so fall back to
  // the static feature toggle to ensure section variables work without auth.
  const sectionVariablesEnabled = getFeatureFlagClient().getBooleanValue(
    FlagKeys.DashboardSectionVariables,
    Boolean(config.featureToggles.dashboardSectionVariables)
  );
  if (!variables || variables.length === 0 || !sectionVariablesEnabled) {
    return undefined;
  }

  // VariableKind is structurally identical to TypedVariableModelV2
  const sceneVariables = variables.map((variable) => createSceneVariableFromVariableModel(variable));
  if (sceneVariables.length === 0) {
    return undefined;
  }

  return new SceneVariableSet({ variables: sceneVariables });
}
