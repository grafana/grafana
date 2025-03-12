import {
  SceneObjectState,
  SceneObjectBase,
  SceneObjectRef,
  sceneGraph,
  VizPanel,
  SceneComponentProps,
} from '@grafana/scenes';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { DropZonePlaceholder } from '../layout-default/DropZonePlaceholder';
import { DashboardLayoutItem, isDashboardLayoutItem } from '../types/DashboardLayoutItem';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { LayoutRegistryItem } from '../types/LayoutRegistryItem';

import { closestOfType, DropZone, isSceneLayout, Point, SceneLayout2 } from './utils';

interface LayoutOrchestratorState extends SceneObjectState {
  manager: DashboardLayoutManager;
  activeLayoutItemRef?: SceneObjectRef<DashboardLayoutItem>;
  placeholderSize?: { width: number; height: number; top: number; left: number };
}

export class LayoutOrchestrator extends SceneObjectBase<LayoutOrchestratorState> implements DashboardLayoutManager {
  public isDashboardLayoutManager: true = true;

  public descriptor: Readonly<LayoutRegistryItem<{}>> = this.state.manager.descriptor;

  /** Offset from top-left corner of drag handle. */
  public dragOffset = { top: 0, left: 0 };

  /** Used in `ResponsiveGridLayout`'s `onPointerDown` method */
  public onDragStart = (e: PointerEvent, panel: VizPanel) => {
    const closestLayoutItem = closestOfType(panel, isDashboardLayoutItem);
    if (!closestLayoutItem) {
      console.warn('Unable to find layout item ancestor in panel hierarchy.');
      return;
    }

    document.body.setPointerCapture(e.pointerId);
    const targetRect = (e.target as HTMLElement).getBoundingClientRect();
    this.dragOffset = { top: e.y - targetRect.top, left: e.x - targetRect.left };
    this.setState({ activeLayoutItemRef: closestLayoutItem.getRef() });
    document.addEventListener('pointermove', this.onDrag);
    document.addEventListener('pointerup', this.onDragEnd);
    document.body.classList.add('dragging-active');
  };

  /** The drop zone closest to the current mouse position while dragging. */
  public activeDropZone: (DropZone & { layout: SceneObjectRef<SceneLayout2> }) | undefined;

  /** Called every tick while a panel is actively being dragged */
  public onDrag = (e: PointerEvent) => {
    const layoutItemContainer = this.state.activeLayoutItemRef?.resolve().containerRef.current;
    if (!layoutItemContainer) {
      this.onDragEnd(e);
      return;
    }

    const cursorPos: Point = { x: e.clientX, y: e.clientY };

    layoutItemContainer.style.setProperty('--x-pos', `${cursorPos.x}px`);
    layoutItemContainer.style.setProperty('--y-pos', `${cursorPos.y}px`);
    const closestDropZone = this.findClosestDropZone(cursorPos);
    if (!dropZonesAreEqual(this.activeDropZone, closestDropZone)) {
      this.activeDropZone = closestDropZone;
      if (this.activeDropZone) {
        this.setState({
          placeholderSize: {
            top: this.activeDropZone.top,
            left: this.activeDropZone.left,
            width: this.activeDropZone.right - this.activeDropZone.left,
            height: this.activeDropZone.bottom - this.activeDropZone.top,
          },
        });
      }
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
    const activeLayoutItemContainer = activeLayoutItem?.containerRef.current;
    const targetLayout = this.activeDropZone?.layout.resolve();

    if (!activeLayoutItem) {
      console.error('No active layout item');
      return;
    } else if (!targetLayout) {
      console.error('No target layout');
      return;
    }

    this.moveLayoutItem(activeLayoutItem, targetLayout);
    this.setState({
      activeLayoutItemRef: undefined,
      placeholderSize: undefined,
    });
    this.activeDropZone = undefined;
    activeLayoutItemContainer?.removeAttribute('style');
  };

  /** Moves layoutItem from its current layout to targetLayout to the location of the current placeholder.
   * Throws if layoutItem does not belong to any layout. */
  private moveLayoutItem(layoutItem: DashboardLayoutItem, targetLayout: SceneLayout2) {
    const sourceLayout = closestOfType(layoutItem, isSceneLayout);
    if (!sourceLayout) {
      throw new Error(`Layout item with key "${layoutItem.state.key}" does not belong to any layout`);
    }

    sourceLayout.removeLayoutItem(layoutItem);
    targetLayout.importLayoutItem(layoutItem);
  }

  public findClosestDropZone(p: Point) {
    const sceneLayouts = sceneGraph.findAllObjects(this.getRoot(), isSceneLayout) as SceneLayout2[];
    let closestDropZone: (DropZone & { layout: SceneObjectRef<SceneLayout2> }) | undefined = undefined;
    let closestDistance = Number.MAX_VALUE;
    for (const layout of sceneLayouts) {
      const curClosestDropZone = layout.closestDropZone(p);
      if (curClosestDropZone.distanceToPoint < closestDistance) {
        closestDropZone = { ...curClosestDropZone, layout: layout.getRef() };
        closestDistance = curClosestDropZone.distanceToPoint;
      }
    }

    return closestDropZone;
  }

  // LayoutManager methods
  getVizPanels(): VizPanel[] {
    return this.state.manager.getVizPanels();
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
    const { manager, placeholderSize } = model.useState();
    const { width, height, top, left } = placeholderSize ?? { width: 0, height: 0, top: 0, left: 0 };

    return (
      <>
        <DropZonePlaceholder width={width} height={height} top={top} left={left} />
        <model.state.manager.Component model={manager} />
      </>
    );
  };
}

function dropZonesAreEqual(a?: DropZone, b?: DropZone) {
  const dims: Array<keyof DropZone> = ['top', 'left', 'bottom', 'right'];
  return a && b && dims.every((dim) => b[dim] === a[dim]);
}
