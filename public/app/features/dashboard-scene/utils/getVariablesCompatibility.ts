import { TypedVariableModel } from '@grafana/data';
import { sceneGraph, SceneObject } from '@grafana/scenes';

import { sceneVariablesSetToVariables } from '../serialization/sceneVariablesSetToVariables';

export function getVariablesCompatibility(sceneObject: SceneObject): TypedVariableModel[] {
  const set = sceneGraph.getVariables(sceneObject);
  const legacyModels = sceneVariablesSetToVariables(set);

  // Sadly templateSrv.getVariables returns TypedVariableModel but sceneVariablesSetToVariables return persisted schema model
  // They look close to identical (differ in what is optional in some places).
  // The way templateSrv.getVariables is used it should not matter. it is mostly used to get names of all variables (for query editors).
  // So type and name are important. Maybe some external data sources also check current value so that is also important.
  // @ts-expect-error
  return legacyModels;
}
