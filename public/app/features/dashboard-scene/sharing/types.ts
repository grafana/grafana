import { SceneObject, SceneObjectRef, SceneObjectState } from '@grafana/scenes';

export interface ModalSceneObjectLike {
  onDismiss: () => void;
}

export interface SceneShareTabState extends SceneObjectState {
  modalRef?: SceneObjectRef<ModalSceneObjectLike>;
}

export interface SceneShareTab<T extends SceneShareTabState = SceneShareTabState> extends SceneObject<T> {
  getTabLabel(): string;
}
