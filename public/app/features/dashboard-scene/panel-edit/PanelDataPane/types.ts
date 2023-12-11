import { IconName } from '@grafana/data';
import { SceneObject, SceneObjectRef, SceneObjectState, VizPanel } from '@grafana/scenes';

export interface PanelDataPaneTabState extends SceneObjectState {
  panelRef: SceneObjectRef<VizPanel>;
}

export interface PanelDataPaneTab extends SceneObject {
  getTabLabel(): string;
  getItemsCount?(): number;
  tabId: string;
  icon: IconName;
}
