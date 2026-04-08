import { type SceneObject, type SceneObjectState } from '@grafana/scenes';
import { type InspectTab } from 'app/features/inspector/types';

export interface SceneInspectTab<T extends SceneObjectState = SceneObjectState> extends SceneObject<T> {
  getTabValue(): InspectTab;
  getTabLabel(): string;
}
