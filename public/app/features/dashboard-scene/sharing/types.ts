import { SceneObject, SceneObjectState } from '@grafana/scenes';

export interface SceneShareTab<T extends SceneObjectState = SceneObjectState> extends SceneObject<T> {
  getTabLabel(): string;
}
