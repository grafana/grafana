import { type TypedVariableModel, type VariableModel } from '@grafana/data';
import { type SceneObject, SceneVariableSet, sceneGraph } from '@grafana/scenes';

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
    const selectedObject = sceneObject.state.editPane.getSelectedObject();

    if (selectedObject) {
      // @ts-expect-error
      return collectAncestorVariables(selectedObject);
    }
  }

  // Default: dashboard global vars
  return collectGlobalVariables(sceneObject);
}

function collectAncestorVariables(sceneObject: SceneObject): VariableModel[] {
  const allModels: VariableModel[] = [];
  const seenNames = new Set<string>();
  const keepQueryOptions = true;

  // The variable being edited is excluded from its own set
  // this is to avoid self-reference in that variable's editor
  const excludedVariable = sceneObject;
  let current: SceneObject | undefined = sceneObject;
  while (current) {
    if (current.state.$variables instanceof SceneVariableSet) {
      const set = current.state.$variables;
      const models = sceneVariablesSetToVariables(set, keepQueryOptions, excludedVariable);

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

function collectGlobalVariables(sceneObject: SceneObject): TypedVariableModel[] {
  const set = sceneGraph.getVariables(sceneObject);
  const keepQueryOptions = true;

  const legacyModels = sceneVariablesSetToVariables(set, keepQueryOptions);

  // Sadly templateSrv.getVariables returns TypedVariableModel but sceneVariablesSetToVariables return persisted schema model
  // They look close to identical (differ in what is optional in some places).
  // The way templateSrv.getVariables is used it should not matter. it is mostly used to get names of all variables (for query editors).
  // So type and name are important. Maybe some external data sources also check current value so that is also important.
  // @ts-expect-error
  return legacyModels;
}
