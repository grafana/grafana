import { sceneGraph, type SceneObject, type SceneObjectState } from '@grafana/scenes';

export function useInterpolatedTitle<T extends SceneObjectState & { title?: string }>(scene: SceneObject<T>): string {
  const { title } = scene.useState();

  if (!title) {
    return '';
  }

  return sceneGraph.interpolate(scene, title, undefined, 'text');
}
