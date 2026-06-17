import type { ScopedVars } from '@grafana/data';
import {
  LocalValueVariable,
  sceneGraph,
  type SceneObject,
  type SceneObjectState,
  SceneVariableSet,
} from '@grafana/scenes';

type RepeatableSectionState = SceneObjectState & {
  repeatByVariable?: string;
  repeatSourceKey?: string;
};

export function interpolateSectionTitle<T extends RepeatableSectionState>(
  scene: SceneObject<T>,
  value: string | undefined | null
): string {
  if (value === '' || value == null) {
    return '';
  }

  // Section titles/slugs should resolve in local scene scope so they can
  // use ancestor section variables (including repeat-local variables).
  if (scene.state.repeatByVariable || scene.state.repeatSourceKey) {
    return sceneGraph.interpolate(scene, value, getRepeatLocalScopedVars(scene), 'text');
  }
  return sceneGraph.interpolate(scene, value, undefined, 'text');
}

function getRepeatLocalScopedVars<T extends RepeatableSectionState>(scene: SceneObject<T>): ScopedVars | undefined {
  const variableSet = scene.state.$variables;
  if (!(variableSet instanceof SceneVariableSet)) {
    return undefined;
  }

  const repeatLocalVariable = variableSet.state.variables.find((variable) => variable instanceof LocalValueVariable);
  if (!(repeatLocalVariable instanceof LocalValueVariable)) {
    return undefined;
  }

  return {
    [repeatLocalVariable.state.name]: {
      value: repeatLocalVariable.getValue(),
      text: repeatLocalVariable.state.text,
    },
  };
}
