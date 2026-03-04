import { TypedVariableModel, VariableModel } from '@grafana/data';
import { SceneObject, SceneVariableSet, sceneGraph } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { sceneVariablesSetToVariables } from '../serialization/sceneVariablesSetToVariables';

export function getVariablesCompatibility(sceneObject: SceneObject): TypedVariableModel[] {
  // When a panel is being edited, scope variables to that panel's ancestry.
  // This ensures the query editor autocomplete only shows the panel's own
  // section variables + dashboard globals, not variables from other sections.
  if (sceneObject instanceof DashboardScene && sceneObject.state.editPanel) {
    const panel = sceneObject.state.editPanel.state.panelRef.resolve();
    // @ts-expect-error
    return collectAncestorVariables(panel);
  }

  // When a scene object is selected in the edit pane (e.g., editing a section variable),
  // scope to that object's ancestry so datasource pickers only show variables from
  // the same section + dashboard globals.
  if (sceneObject instanceof DashboardScene) {
    const selectedObject = sceneObject.state.editPane.state.selection?.getFirstObject();
    if (selectedObject && selectedObject !== sceneObject) {
      // @ts-expect-error
      return collectAncestorVariables(selectedObject);
    }
  }

  // If called with a non-root scene object, walk up its ancestry
  if (!(sceneObject instanceof DashboardScene)) {
    // @ts-expect-error
    return collectAncestorVariables(sceneObject);
  }

  // Default: dashboard vars + all section vars (for dashboard view mode)
  return collectAllVariables(sceneObject);
}

function collectAncestorVariables(sceneObject: SceneObject): VariableModel[] {
  const allModels: VariableModel[] = [];
  const seenNames = new Set<string>();
  const keepQueryOptions = true;

  let current: SceneObject | undefined = sceneObject;
  while (current) {
    if (current.state.$variables instanceof SceneVariableSet) {
      const models = sceneVariablesSetToVariables(current.state.$variables, keepQueryOptions);
      for (const model of models) {
        if (!seenNames.has(model.name)) {
          allModels.push(model);
          seenNames.add(model.name);
        }
      }
    }
    current = current.parent;
  }

  return allModels;
}

function collectAllVariables(sceneObject: SceneObject): TypedVariableModel[] {
  const set = sceneGraph.getVariables(sceneObject);
  const keepQueryOptions = true;

  const legacyModels = sceneVariablesSetToVariables(set, keepQueryOptions);
  const dashboardNames = new Set(legacyModels.map((v) => v.name));

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
