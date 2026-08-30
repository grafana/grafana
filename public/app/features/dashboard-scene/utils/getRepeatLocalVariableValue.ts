import {
  LocalValueVariable,
  sceneGraph,
  type SceneObject,
  SceneVariableSet,
  type VariableValueSingle,
} from '@grafana/scenes';

export function getRepeatLocalVariableValue(
  sceneObject: SceneObject,
  varName: string
): VariableValueSingle | undefined {
  const variableSet = sceneObject.state.$variables;
  if (variableSet instanceof SceneVariableSet) {
    const localVariable = variableSet.state.variables.find(
      (variable) => variable instanceof LocalValueVariable && variable.state.name === varName
    );
    if (localVariable instanceof LocalValueVariable) {
      const localValue = localVariable.getValue();
      if (localValue != null && !Array.isArray(localValue)) {
        return localValue;
      }
      return undefined;
    }
  }

  const value = sceneGraph.lookupVariable(varName, sceneObject)?.getValue();
  if (value != null && !Array.isArray(value)) {
    return value;
  }

  return undefined;
}
