import { SceneObject, SceneObjectRef, SceneObjectState } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';

export interface ModalSceneObjectLike {
  onDismiss: () => void;
}

export interface SceneShareTabState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
  modalRef?: SceneObjectRef<ModalSceneObjectLike>;
}

export interface SceneShareTab<T extends SceneShareTabState = SceneShareTabState> extends SceneObject<T> {
  getTabLabel(): string;
  tabId: string;
}
