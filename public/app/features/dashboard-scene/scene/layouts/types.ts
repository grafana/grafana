import { SceneObject, VizPanel } from '@grafana/scenes';

export interface LayoutDescriptor {
  name: string;
  id: string;
  switchTo: (current: DashboardLayoutManager) => DashboardLayoutManager;
  //  editor: React.ComponentType<LayoutEditorProps<any>>;
  // getVizPanels(): VizPanel;
}

export interface LayoutEditorProps<T extends SceneObject = SceneObject> {
  layout: T;
}

export interface DashboardLayoutManager extends SceneObject {
  getLayoutId(): string;
  editModeChanged(isEditing: boolean): void;
  cleanUpStateFromExplore?(): void;
  addPanel(vizPanel: VizPanel): void;
  addNewRow?(): void;
  getNextPanelId(): number;
  /**
   * Used for transferring state between layouts. Not sure what the return type should be here.
   * Right now we just check for VizPanels
   */
  getObjects(): SceneObject[];
  getEditor?(): React.ComponentType<LayoutEditorProps>;
}
