import { SceneObject, VizPanel } from '@grafana/scenes';

export interface LayoutDescriptor {
  name: string;
  id: string;
  //  editor: React.ComponentType<LayoutEditorProps<any>>;
  // getVizPanels(): VizPanel;
}

export interface LayoutEditorProps<T extends SceneObject = SceneObject> {
  layout: T;
}

export interface DashboardLayoutManager extends SceneObject {
  editModeChanged(isEditing: boolean): void;
  cleanUpStateFromExplore?(): void;
  addPanel(vizPanel: VizPanel): void;
  addNewRow?(): void;
  removeRow?(row: SceneObject): void;
  getNextPanelId(): number;
}
