import { IconName } from '@grafana/data';
import { SceneObject, SceneObjectState } from '@grafana/scenes';

export interface PanelDataPaneTabState extends SceneObjectState {}

export interface PanelDataPaneTab extends SceneObject {
  getTabLabel(): string;
  tabId: string;
  icon: IconName;
}
