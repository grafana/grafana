import { TypedVariableModel } from '@grafana/data';
import { SceneObject, SceneVariableSet, sceneGraph } from '@grafana/scenes';

import { sceneVariablesSetToVariables } from '../serialization/sceneVariablesSetToVariables';

export function getVariablesCompatibility(sceneObject: SceneObject): TypedVariableModel[] {
  const set = sceneGraph.getVariables(sceneObject);
  const keepQueryOptions = true;

  // `sceneVariablesSetToVariables` is also used when transforming the scene to a save model.
  // In those cases, query options will be stripped out.
  // However, when `getVariablesCompatibility` is called from `templateSrv`, it is used to get all variables in the scene.
  // Therefore, options should be kept.
  const legacyModels = sceneVariablesSetToVariables(set, keepQueryOptions);
  const dashboardNames = new Set(legacyModels.map((v) => v.name));

  // Collect section-level variables (from rows/tabs) so they appear in query editor autocomplete.
  // Walk the scene tree to find all SceneVariableSets beyond the dashboard-level one.
  const sectionSets: SceneVariableSet[] = [];
  collectChildVariableSets(sceneObject, sectionSets);

  for (const sectionSet of sectionSets) {
    const sectionModels = sceneVariablesSetToVariables(sectionSet, keepQueryOptions);
    for (const model of sectionModels) {
      if (!dashboardNames.has(model.name)) {
        legacyModels.push(model);
        dashboardNames.add(model.name);
      }
    }
  }

  // Sadly templateSrv.getVariables returns TypedVariableModel but sceneVariablesSetToVariables return persisted schema model
  // They look close to identical (differ in what is optional in some places).
  // The way templateSrv.getVariables is used it should not matter. it is mostly used to get names of all variables (for query editors).
  // So type and name are important. Maybe some external data sources also check current value so that is also important.
  // @ts-expect-error
  return legacyModels;
}

function collectChildVariableSets(sceneObject: SceneObject, result: SceneVariableSet[]): void {
  sceneObject.forEachChild((child) => {
    if (child.state.$variables instanceof SceneVariableSet) {
      result.push(child.state.$variables);
    }
    collectChildVariableSets(child, result);
  });
}
