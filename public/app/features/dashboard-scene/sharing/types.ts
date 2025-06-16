import { SceneObject, SceneObjectRef, SceneObjectState } from '@grafana/scenes';

export interface ModalSceneObjectLike {
  onDismiss: () => void;
}

export interface SceneShareTabState extends SceneObjectState, Partial<ModalSceneObjectLike> {
  modalRef?: SceneObjectRef<ModalSceneObjectLike>;
}

export interface SceneShareTab<T extends SceneShareTabState = SceneShareTabState> extends SceneObject<T> {
  getTabLabel(): string;
  tabId: string;
}

export interface ShareView extends SceneObject {
  getTabLabel(): string;
  onDismiss?: () => void;
}
