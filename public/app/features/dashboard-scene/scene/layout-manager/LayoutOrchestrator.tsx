import { createRef } from 'react';

import {
  SceneObjectState,
  SceneObjectBase,
  SceneObjectRef,
  sceneGraph,
  VizPanel,
  SceneComponentProps,
} from '@grafana/scenes';
import { Portal } from '@grafana/ui';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { DropZonePlaceholder } from '../layout-default/DropZonePlaceholder';
import { DashboardLayoutItem, isDashboardLayoutItem } from '../types/DashboardLayoutItem';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { LayoutRegistryItem } from '../types/LayoutRegistryItem';

import { closestOfType, DropZone, isSceneLayout, Point, SceneLayout2 } from './utils';

interface LayoutOrchestratorState extends SceneObjectState {
  manager: DashboardLayoutManager;
  activeLayoutItemRef?: SceneObjectRef<DashboardLayoutItem>;
}

export class LayoutOrchestrator extends SceneObjectBase<LayoutOrchestratorState> implements DashboardLayoutManager {
  public isDashboardLayoutManager: true = true;

  /** Rectangles representing areas the dragged panel can be placed */
  public dropZones: DropZone[] = [];

  /**
   * Ref to the div containing the panel as it's being dragged.
   * Needed for updating css transform without causing react to re-render.
   */
  public floatingPanelRef = createRef<HTMLDivElement>();

  /**
   * Ref to the div containing the dropzone placeholder/preview.
   * Needed for updating css transform without causing react to re-render.
   */
  public placeholderRef = createRef<HTMLDivElement>();

  public descriptor: Readonly<LayoutRegistryItem<{}>> = this.state.manager.descriptor;

  /** Used in `SceneCSSGridLayout`'s `onPointerDown` method */
  public onDragStart = (e: PointerEvent, panel: VizPanel) => {
    const closestLayoutItem = closestOfType(panel, isDashboardLayoutItem);
    if (!closestLayoutItem) {
      console.warn('Unable to find layout item ancestor in panel hierarchy.');
      return;
    }

    this.setState({ activeLayoutItemRef: closestLayoutItem.getRef() });
    document.addEventListener('pointermove', this.onDrag);
    document.addEventListener('pointerup', this.onDragEnd);
    document.body.classList.add('dragging-active');
  };

  /** Called every tick while a panel is actively being dragged */

  public activeDropZone: (DropZone & { layout: SceneObjectRef<SceneLayout2> }) | undefined;

  public onDrag = (e: PointerEvent) => {
    const layoutItemContainer = this.state.activeLayoutItemRef?.resolve().containerRef.current;
    if (!layoutItemContainer) {
      this.onDragEnd(e);
      return;
    }

    const cursorPos: Point = { x: e.clientX, y: e.clientY };
    layoutItemContainer.style.transform = `translate(${cursorPos.x}px,${cursorPos.y}px)`;
    const closestDropZone = this.findClosestDropZone(cursorPos);
    if (!dropZonesAreEqual(this.activeDropZone, closestDropZone)) {
      this.activeDropZone = closestDropZone;
    }
  };

  /**
   * Called when the panel drag operation ends.
   * Clears up event listeners and any scratch state.
   */
  public onDragEnd = (e: PointerEvent) => {
    document.removeEventListener('pointermove', this.onDrag);
    document.removeEventListener('pointerup', this.onDragEnd);
    document.body.releasePointerCapture(e.pointerId);
    document.body.classList.remove('dragging-active');

    const activeLayoutItem = this.state.activeLayoutItemRef?.resolve();
    const targetLayout = this.activeDropZone?.layout.resolve();

    this.setState({ activeLayoutItemRef: undefined });
    this.activeDropZone = undefined;

    if (!activeLayoutItem) {
      console.error('No active layout item');
      return;
    } else if (!targetLayout) {
      console.error('No target layout');
      return;
    }

    moveLayoutItem(activeLayoutItem, targetLayout);
  };

  public findClosestDropZone(p: Point) {
    const sceneLayouts = sceneGraph.findAllObjects(this.getRoot(), isSceneLayout) as SceneLayout2[];
    let closestDropZone: (DropZone & { layout: SceneObjectRef<SceneLayout2> }) | undefined = undefined;
    let closestDistance = Number.MAX_VALUE;
    for (const layout of sceneLayouts) {
      const curClosestDropZone = layout.closestDropZone(p);
      if (curClosestDropZone.distance < closestDistance) {
        closestDropZone = { ...curClosestDropZone, layout: layout.getRef() };
        closestDistance = curClosestDropZone.distance;
      }
    }

    return closestDropZone;
  }

  // LayoutManager methods
  getVizPanels(): VizPanel[] {
    return this.state.manager.getVizPanels();
  }

  hasVizPanels(): boolean {
    return this.state.manager.hasVizPanels();
  }

  editModeChanged(isEditing: boolean): void {
    return this.state.manager.editModeChanged?.(isEditing);
  }

  removePanel(panel: VizPanel): void {
    return this.state.manager.removePanel?.(panel);
  }

  duplicatePanel(panel: VizPanel): void {
    return this.state.manager.duplicatePanel?.(panel);
  }

  addPanel(panel: VizPanel): void {
    return this.state.manager.addPanel(panel);
  }

  addNewTab(): void {
    return;
  }

  toSaveModel() {
    return this.state.manager.toSaveModel?.() ?? {};
  }

  activateRepeaters?(): void {
    return this.state.manager.activateRepeaters?.();
  }

  getOptions?(): OptionsPaneItemDescriptor[] {
    return this.state.manager.getOptions?.() ?? [];
  }

  public switchLayout(layoutManager: DashboardLayoutManager) {
    this.setState({ manager: layoutManager });
  }

  public cloneLayout(ancestorKey: string, isSource: boolean): DashboardLayoutManager {
    return this.state.manager.cloneLayout(ancestorKey, isSource);
  }

  public static Component = ({ model }: SceneComponentProps<LayoutOrchestrator>) => {
    const { manager, activeLayoutItemRef: activeLayoutItem } = model.useState();
    const activeItem = activeLayoutItem?.resolve();

    return (
      <>
        <Portal>{activeItem && <DropZonePlaceholder ref={model.placeholderRef} />}</Portal>
        <model.state.manager.Component model={manager} />
      </>
    );
  };
}

function dropZonesAreEqual(a?: DropZone, b?: DropZone) {
  return a && b && Object.entries(a).every(([key, val]) => b[key as keyof DropZone] === val);
}

/** Moves layoutItem from its current layout to targetLayout.
 * Throws if layoutItem does not belong to any layout. */
function moveLayoutItem(layoutItem: DashboardLayoutItem, targetLayout: SceneLayout2) {
  const sourceLayout = closestOfType(layoutItem, isSceneLayout);
  if (!sourceLayout) {
    throw new Error(`Layout item with key "${layoutItem.state.key}" does not belong to any layout`);
  }

  sourceLayout.removeLayoutItem(layoutItem);
  targetLayout.importLayoutItem(layoutItem);
}
