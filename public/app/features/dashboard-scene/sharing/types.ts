import { SceneObject, SceneObjectRef, SceneObjectState, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';

export interface ModalSceneObjectLike {
  onDismiss: () => void;
}

export interface SceneShareTabState extends SceneObjectState {
  modalRef?: SceneObjectRef<ModalSceneObjectLike>;
}

export interface SceneShareTab<T extends SceneShareTabState = SceneShareTabState> extends SceneObject<T> {
  getTabLabel(): string;
  tabId: string;
}

export interface SceneShareDrawerState extends SceneObjectState {
  dashboardRef?: SceneObjectRef<DashboardScene>;
  panelRef?: SceneObjectRef<VizPanel>;
}
