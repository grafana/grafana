import { SceneObject, VizPanel } from '@grafana/scenes';

export interface LayoutDescriptor {
  name: string;
  id: string;
  switchTo: (current: DashboardLayoutManager) => DashboardLayoutManager;
  //  editor: React.ComponentType<LayoutEditorProps<any>>;
  // getVizPanels(): VizPanel;
}

export interface LayoutEditorProps<T> {
  layoutManager: T;
}

export interface DashboardLayoutManager extends SceneObject {
  getLayoutId(): string;
  editModeChanged(isEditing: boolean): void;
  cleanUpStateFromExplore?(): void;
  addPanel(vizPanel: VizPanel): void;
  /**
   * For now not all layouts support rows, but in the long run we should be able to refactor rows to a more high level layout concept (where they contain an inner layout)
   * Will try this for tabs first
   */
  addNewRow?(): void;
  /**
   * Not sure we will need this in the long run, we should be able to handle this inside addPanel
   */
  getNextPanelId(): number;
  /**
   * Used for transferring state between layouts. Not sure what the return type should be here.
   * Right now we just check for VizPanels
   */
  getObjects(): SceneObject[];
  renderEditor?(): React.ReactNode;
  getDescriptor(): LayoutDescriptor;
}
