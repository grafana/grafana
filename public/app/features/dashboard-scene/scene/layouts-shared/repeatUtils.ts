import { CustomVariableValue, isCustomVariableValue, SceneObject } from '@grafana/scenes';
import { VariableFormatID } from '@grafana/schema';

export const REPEAT_KEY_SUFFIX = '-clone-';

export function getRepeatKey(
  prefix: string | undefined = '',
  suffix: string | number | boolean | CustomVariableValue = ''
): string {
  if (isCustomVariableValue(suffix)) {
    suffix = suffix.formatter(VariableFormatID.Text);
  }

  return `${prefix}${REPEAT_KEY_SUFFIX}${suffix}`;
}

export function getRepeatKeyForSceneObject(
  sceneObject: SceneObject,
  suffix: string | number | boolean | CustomVariableValue = ''
): string {
  return getRepeatKey(sceneObject.state.key, suffix);
}

export function isRepeatedSceneObject(sceneObject: SceneObject): boolean {
  return (sceneObject.state.key ?? '').includes(REPEAT_KEY_SUFFIX);
}

export function isRepeatedSceneObjectOf(sceneObject1: SceneObject, sceneObject2: SceneObject): boolean {
  return (sceneObject1.state.key ?? '').startsWith(getRepeatKeyForSceneObject(sceneObject2));
}
