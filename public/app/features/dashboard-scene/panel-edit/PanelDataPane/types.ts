import { IconName } from '@grafana/data';
import { SceneObject, SceneObjectState } from '@grafana/scenes';

export interface PanelDataPaneTabState extends SceneObjectState {}

export interface PanelDataPaneTab extends SceneObject {
  getTabLabel(): string;
  getItemsCount?(): number | null;
  tabId: string;
  icon: IconName;
}
