import { type SceneObject, type SceneObjectRef, type SceneObjectState } from '@grafana/scenes';

export interface ModalSceneObjectLike {
  onDismiss: () => void;
}

export interface SceneShareTabState extends SceneObjectState, Partial<ModalSceneObjectLike> {
  modalRef?: SceneObjectRef<ModalSceneObjectLike>;
}

export interface ShareView extends SceneObject {
  getTabLabel(): string;
  getSubtitle?(): string | undefined;
  onDismiss?: () => void;
}
