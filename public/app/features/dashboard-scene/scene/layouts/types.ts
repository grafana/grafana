import { SceneObject, VizPanel } from '@grafana/scenes';

export interface LayoutDescriptor {
  name: string;
  id: string;
  /**
   * This is for creating a new layout from the elements of another layout
   * @param elements
   * @returns
   */
  create: () => DashboardLayoutManager;
}

export interface LayoutEditorProps<T> {
  layoutManager: T;
}

export interface DashboardLayoutManager extends SceneObject {
  getLayoutId(): string;
  editModeChanged(isEditing: boolean): void;
  cleanUpStateFromExplore?(): void;
  /**
   * Not sure we will need this in the long run, we should be able to handle this inside addPanel
   */
  getNextPanelId(): number;
  /**
   * Used for transferring state between layouts. Not sure what the return type should be here.
   * Right now we just check for VizPanels
   */
  getElements(): LayoutElementInfo[];
  renderEditor?(): React.ReactNode;
  getDescriptor(): LayoutDescriptor;
  /**
   * When switching between layouts
   * @param currentLayout
   */
  initFromLayout(currentLayout: DashboardLayoutManager): DashboardLayoutManager;
}

export interface LayoutElementInfo {
  body: SceneObject;
  width?: number;
  height?: number;
}

export interface LayoutParent extends SceneObject {
  switchLayout(newLayout: DashboardLayoutManager): void;
}

export function isLayoutParent(obj: SceneObject): obj is LayoutParent {
  return 'switchLayout' in obj;
}
