import { SceneObjectState, SceneObjectBase, SceneObjectRef, sceneGraph, VizPanel } from '@grafana/scenes';

import { DashboardLayoutItem, isDashboardLayoutItem } from '../types/DashboardLayoutItem';

import { DropZonePlaceholder } from './DropZonePlaceholder';
import { closestOfType, DropZone, isSceneLayoutWithDragAndDrop, Point, SceneLayoutWithDragAndDrop } from './utils';

interface LayoutOrchestratorState extends SceneObjectState {
  activeLayoutItemRef?: SceneObjectRef<DashboardLayoutItem>;
  placeholder?: DropZonePlaceholder;
}

export class LayoutOrchestrator extends SceneObjectBase<LayoutOrchestratorState> {
  /** Offset from top-left corner of drag handle. */
  public dragOffset = { top: 0, left: 0 };

  /** Used in `ResponsiveGridLayout`'s `onPointerDown` method */
  public onDragStart = (e: PointerEvent, panel: VizPanel) => {
    const closestLayoutItem = closestOfType(panel, isDashboardLayoutItem);
    if (!closestLayoutItem) {
      console.warn('Unable to find layout item ancestor in panel hierarchy.');
      return;
    }

    if (!(e.target instanceof HTMLElement)) {
      console.warn('Target is not a HTML element.');
      return;
    }

    document.body.setPointerCapture(e.pointerId);
    const targetRect = e.target.getBoundingClientRect();
    this.dragOffset = { top: e.y - targetRect.top, left: e.x - targetRect.left };
    this.setState({ activeLayoutItemRef: closestLayoutItem.getRef() });
    document.addEventListener('pointermove', this.onDrag);
    document.addEventListener('pointerup', this.onDragEnd);
    document.body.classList.add('dragging-active');
  };

  /** The drop zone closest to the current mouse position while dragging. */
  public activeDropZone: (DropZone & { layout: SceneObjectRef<SceneLayoutWithDragAndDrop> }) | undefined;

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
          placeholder: new DropZonePlaceholder({
            top: this.activeDropZone.top,
            left: this.activeDropZone.left,
            width: this.activeDropZone.right - this.activeDropZone.left,
            height: this.activeDropZone.bottom - this.activeDropZone.top,
          }),
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
    });
    this.state.placeholder?.setState({
      top: 0,
      left: 0,
      width: 0,
      height: 0,
    });
    this.activeDropZone = undefined;
    activeLayoutItemContainer?.removeAttribute('style');
  };

  /** Moves layoutItem from its current layout to targetLayout to the location of the current placeholder.
   * Throws if layoutItem does not belong to any layout. */
  private moveLayoutItem(layoutItem: DashboardLayoutItem, targetLayout: SceneLayoutWithDragAndDrop) {
    const sourceLayout = closestOfType(layoutItem, isSceneLayoutWithDragAndDrop);
    if (!sourceLayout) {
      throw new Error(`Layout item with key "${layoutItem.state.key}" does not belong to any layout`);
    }

    sourceLayout.removeLayoutItem(layoutItem);
    targetLayout.importLayoutItem(layoutItem);
  }

  public findClosestDropZone(p: Point) {
    const sceneLayouts = sceneGraph
      .findAllObjects(this.getRoot(), isSceneLayoutWithDragAndDrop)
      .filter(isSceneLayoutWithDragAndDrop);
    let closestDropZone: (DropZone & { layout: SceneObjectRef<SceneLayoutWithDragAndDrop> }) | undefined = undefined;
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
}

function dropZonesAreEqual(a?: DropZone, b?: DropZone) {
  const dims: Array<keyof DropZone> = ['top', 'left', 'bottom', 'right'];
  return a && b && dims.every((dim) => b[dim] === a[dim]);
}
