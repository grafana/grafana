import { SceneObject, SceneObjectState } from '@grafana/scenes';

export const trailsDS = { uid: 'gdev-prometheus', type: 'prometheus' };

export interface DataTrailActionView<T extends SceneObjectState = SceneObjectState> extends SceneObject<T> {
  getName(): string;
}

export interface ActionViewDefinition {
  name: string;
  value: string;
  getScene: () => DataTrailActionView;
}
