import { IconName } from '@grafana/data';
import { SceneObject, SceneObjectState } from '@grafana/scenes';

export interface PanelDataPaneTabState extends SceneObjectState {}

export enum TabId {
  Queries = 'queries',
  Transformations = 'transformations',
  Alert = 'alert',
}

export interface PanelDataPaneTab extends SceneObject {
  getTabLabel(): string;
  tabId: TabId;
  icon: IconName;
}
