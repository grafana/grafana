import { createRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';

import {
  type SceneLayout,
  SceneObjectBase,
  type SceneObjectState,
  type VizPanel,
  type SceneGridItemLike,
} from '@grafana/scenes';

import { isRepeatCloneOrChildOf } from '../../utils/clone';
import { getLayoutOrchestratorFor } from '../../utils/utils';
import { isUnifiedDragAndDropEnabled } from '../layouts-shared/unifiedDragAndDrop';
import { AUTO_GRID_ITEM_DROP_TARGET_ATTR } from '../types/DashboardDropTarget';

import { AutoGridDragSession } from './AutoGridDragSession';
import { AutoGridItem } from './AutoGridItem';
import { AutoGridLayoutRenderer } from './AutoGridLayoutRenderer';
import { DRAGGED_ITEM_HEIGHT, DRAGGED_ITEM_LEFT, DRAGGED_ITEM_TOP, DRAGGED_ITEM_WIDTH } from './const';

/** How far the pointer moves before the floating panel lets the pointer through, so a click on its header stays a click */
const LIFT_THRESHOLD_PX = 4;

export interface AutoGridLayoutState extends SceneObjectState, AutoGridLayoutOptions {
  children: AutoGridItem[];

  draggedChildren?: AutoGridItem[];

  /**
   * True when the item should be rendered but not visible.
   * Useful for conditional display of layout items
   */
  isHidden?: boolean;

  /**
   * For media query for screens smaller than md breakpoint
   */
  md?: AutoGridLayoutOptions;

  /** True when the items should be draggable */
  isDraggable?: boolean;

  /** The key of the item being dragged */
  draggingKey?: string;

  /** True while the item being dragged is outside of this grid, which then closes the gap it left */
  isDraggedItemOutside?: boolean;
}

interface AutoGridLayoutOptions {
  /**
   * Useful for setting a height on items without specifying how many rows there will be.
   * Defaults to 320px
   */
  autoRows?: CSSProperties['gridAutoRows'];
  /**
   * This overrides the autoRows with a specific row template.
   */
  templateRows?: CSSProperties['gridTemplateRows'];
  /**
   * Defaults to repeat(auto-fit, minmax(400px, 1fr)). This pattern us useful for equally sized items with a min width of 400px
   * and dynamic max width split equally among columns.
   */
  templateColumns: CSSProperties['gridTemplateColumns'];
  /** In Grafana design system grid units (8px)  */
  rowGap: number;
  /** In Grafana design system grid units (8px)  */
  columnGap: number;
  justifyItems?: CSSProperties['justifyItems'];
  alignItems?: CSSProperties['alignItems'];
  justifyContent?: CSSProperties['justifyContent'];
}

export class AutoGridLayout extends SceneObjectBase<AutoGridLayoutState> implements SceneLayout {
  public static Component = AutoGridLayoutRenderer;

  public containerRef = createRef<HTMLDivElement>();
  private _draggedGridItem: AutoGridItem | null = null;
  private _initialGridItemPosition: {
    pageX: number;
    pageY: number;
    top: number;
    left: number;
  } | null = null;
  /** Container's initial page position, used to compensate for layout shifts during drag */
  private _initialContainerRect: { top: number; left: number } | null = null;
  private _lastDropTargetGridItemKey: string | null = null;
  /** Set for drags on the unified drag and drop engine */
  private _dragSession: AutoGridDragSession | null = null;
  private _draggedItemSize: { width: number; height: number } | null = null;
  /** For drags on the unified engine, where the floating panel is positioned in the viewport */
  private _lastPointer: { clientX: number; clientY: number } | null = null;
  private _grabOffset: { x: number; y: number } | null = null;
  private _pressPoint: { x: number; y: number } | null = null;
  private _isLifted = false;
  protected _renderBeforeActivation = true;

  public constructor(state: Partial<AutoGridLayoutState>) {
    super({
      rowGap: 1,
      columnGap: 1,
      templateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
      autoRows: state.autoRows ?? `320px`,
      children: state.children ?? [],
      ...state,
    });

    this._onDragStart = this._onDragStart.bind(this);
    this._onDragEnd = this._onDragEnd.bind(this);
    this._onDrag = this._onDrag.bind(this);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    return () => {
      this._resetPanelPositionAndSize();
      document.body.classList.remove('dashboard-draggable-transparent-selection');
    };
  }

  public isDraggable(): boolean {
    if (isRepeatCloneOrChildOf(this)) {
      return false;
    }

    return this.state.isDraggable ?? false;
  }

  public getDragClass(): string {
    return `grid-drag-handle-${this.state.key}`;
  }

  public getDragClassCancel(): string {
    return 'grid-drag-cancel';
  }

  public getDragHooks() {
    if (!this.isDraggable()) {
      return {};
    }

    return {
      onDragStart: (evt: ReactPointerEvent, panel: VizPanel) => {
        const gridItem = panel.parent;
        if (gridItem instanceof AutoGridItem) {
          this._onDragStart(evt, gridItem);
        }
      },
    };
  }

  private _canDrag(evt: ReactPointerEvent): boolean {
    if (!this.isDraggable()) {
      return false;
    }

    if (!(evt.target instanceof Element)) {
      return false;
    }

    return !!evt.target.closest(`.${this.getDragClass()}`) && !evt.target.closest(`.${this.getDragClassCancel()}`);
  }

  // Start inside dragging
  private _onDragStart(evt: ReactPointerEvent, gridItem: SceneGridItemLike) {
    if (!this._canDrag(evt)) {
      return;
    }

    evt.preventDefault();
    evt.stopPropagation();

    if (!(gridItem instanceof AutoGridItem)) {
      throw new Error('Dragging wrong item');
    }

    this._draggedGridItem = gridItem;
    this._lastDropTargetGridItemKey = gridItem.state.key!;

    const { top, left, width, height } = this._draggedGridItem.getBoundingBox();
    this._initialGridItemPosition = { pageX: evt.pageX, pageY: evt.pageY, top, left: left };

    // Capture container's initial page position to compensate for layout shifts
    // (e.g., when a grid above expands due to placeholder insertion)
    const containerRect = this.containerRef.current?.getBoundingClientRect();
    this._initialContainerRect = containerRect ? { top: containerRect.top, left: containerRect.left } : null;

    this._updatePanelSize(width, height);
    this._updatePanelPosition(top, left);

    this.setState({ draggingKey: this._draggedGridItem.state.key });

    document.body.classList.add('dashboard-draggable-transparent-selection');

    getLayoutOrchestratorFor(this)?.startDraggingSync(evt, this._draggedGridItem, {
      onDrag: this._onDrag,
      onDragEnd: this._onDragEnd,
    });

    if (isUnifiedDragAndDropEnabled()) {
      this._startDragSession(evt, width, height);
    }
  }

  private _startDragSession(evt: ReactPointerEvent, width: number, height: number) {
    this._dragSession?.stop();
    this._draggedItemSize = { width, height };
    this._lastPointer = { clientX: evt.clientX, clientY: evt.clientY };
    this._pressPoint = { x: evt.clientX, y: evt.clientY };
    this._isLifted = false;
    const rect = this._draggedGridItem?.containerRef.current?.getBoundingClientRect();
    this._grabOffset = rect ? { x: evt.clientX - rect.left, y: evt.clientY - rect.top } : { x: 0, y: 0 };
    this._moveFloatingPanel(evt.clientX, evt.clientY);
    this._dragSession = new AutoGridDragSession({
      getContainer: () => this.containerRef.current,
      followPointer: (isNewContainer) => {
        if (isNewContainer && this._draggedItemSize) {
          this._updatePanelSize(this._draggedItemSize.width, this._draggedItemSize.height);
        }
        if (isNewContainer && this._isLifted) {
          this._setFloatingPanelPointerEvents('none');
        }
        if (this._lastPointer) {
          this._moveFloatingPanel(this._lastPointer.clientX, this._lastPointer.clientY);
        }
      },
      cancel: () => this._cancelDrag(),
    });
    this._dragSession.start();
  }

  /** Ends the drag without dropping the panel anywhere, so it goes back to where it was */
  private _cancelDrag() {
    // Ends the orchestrator's drag as well, which calls `_onDragEnd`
    getLayoutOrchestratorFor(this)?.cancelDraggingSync();
    if (this._draggedGridItem) {
      this._onDragEnd();
    }
  }

  // Stop inside dragging
  private _onDragEnd() {
    window.getSelection()?.removeAllRanges();

    if (this._isLifted) {
      this._setFloatingPanelPointerEvents(null);
    }
    this._isLifted = false;
    this._pressPoint = null;
    this._draggedGridItem = null;
    this._initialGridItemPosition = null;
    this._initialContainerRect = null;
    this._lastDropTargetGridItemKey = null;
    this._dragSession?.stop();
    this._dragSession = null;
    this._draggedItemSize = null;
    this._lastPointer = null;
    this._grabOffset = null;

    this._resetPanelPositionAndSize();
    this.setState({ draggingKey: undefined, isDraggedItemOutside: undefined });

    document.body.classList.remove('dashboard-draggable-transparent-selection');

    if (this.state.draggedChildren) {
      this.setState({ draggedChildren: undefined });
    }
  }

  // Handle inside drag moves
  private _onDrag(evt: PointerEvent) {
    if (!this.isDraggable() || !this._draggedGridItem || !this._initialGridItemPosition) {
      this._onDragEnd();
      return;
    }

    if (this._dragSession) {
      // The release happened where the page could not see it, e.g. in another window
      if (evt.buttons === 0) {
        this._cancelDrag();
        return;
      }
      this._lastPointer = { clientX: evt.clientX, clientY: evt.clientY };
      this._moveFloatingPanel(evt.clientX, evt.clientY);
      this._liftFloatingPanel(evt.clientX, evt.clientY);
    } else {
      this._moveDraggedPanel(evt.pageX, evt.pageY);
    }

    if (this._dragSession) {
      const isOutside = this._dragSession.isOutside(evt.clientX, evt.clientY);
      this._setDraggedItemOutside(isOutside);
      if (isOutside) {
        return;
      }
    }

    const dropTargetGridItemKey = document
      .elementsFromPoint(evt.clientX, evt.clientY)
      ?.find((element) => {
        const key = element.getAttribute(AUTO_GRID_ITEM_DROP_TARGET_ATTR);

        return !!key && key !== this._draggedGridItem!.state.key;
      })
      ?.getAttribute(AUTO_GRID_ITEM_DROP_TARGET_ATTR);

    if (dropTargetGridItemKey && dropTargetGridItemKey !== this._lastDropTargetGridItemKey) {
      this._onDragOverItem(dropTargetGridItemKey);
    }
  }

  private _moveDraggedPanel(pageX: number, pageY: number) {
    if (!this._initialGridItemPosition) {
      return;
    }

    // Calculate how much the container has shifted since drag started
    // This can happen when a grid above expands (e.g., placeholder causes row wrap)
    let containerShiftY = 0;
    let containerShiftX = 0;
    if (this._initialContainerRect && this.containerRef.current) {
      const currentRect = this.containerRef.current.getBoundingClientRect();
      containerShiftY = currentRect.top - this._initialContainerRect.top;
      containerShiftX = currentRect.left - this._initialContainerRect.left;
    }

    // Adjust position to compensate for container movement
    this._updatePanelPosition(
      this._initialGridItemPosition.top + (pageY - this._initialGridItemPosition.pageY) - containerShiftY,
      this._initialGridItemPosition.left + (pageX - this._initialGridItemPosition.pageX) - containerShiftX
    );
  }

  /**
   * On the unified engine the floating panel is fixed in the viewport, so it stays under the pointer while the
   * dashboard scrolls and is not clipped by the dashboard's scroll container
   */
  private _moveFloatingPanel(clientX: number, clientY: number) {
    if (this._grabOffset) {
      this._updatePanelPosition(clientY - this._grabOffset.y, clientX - this._grabOffset.x);
    }
  }

  /**
   * Once the press became a drag, the floating panel lets the pointer through, so the mouse wheel scrolls the
   * dashboard under it: it would not from a fixed element. Until then a press on its header stays a click.
   */
  private _liftFloatingPanel(clientX: number, clientY: number) {
    const press = this._pressPoint;
    if (this._isLifted || !press || Math.hypot(clientX - press.x, clientY - press.y) < LIFT_THRESHOLD_PX) {
      return;
    }
    this._isLifted = true;
    this._setFloatingPanelPointerEvents('none');
  }

  /** On the dragged item's cell, from which the floating panel inherits it */
  private _setFloatingPanelPointerEvents(value: 'none' | null) {
    const element = this._draggedGridItem?.containerRef.current;
    if (value) {
      element?.style.setProperty('pointer-events', value);
    } else {
      element?.style.removeProperty('pointer-events');
    }
  }

  private _setDraggedItemOutside(isOutside: boolean) {
    if (isOutside === !!this.state.isDraggedItemOutside) {
      return;
    }
    if (!isOutside && this._draggedGridItem) {
      // Coming back reopens the slot at the item under the pointer, so every item counts as newly hovered
      this._lastDropTargetGridItemKey = this._draggedGridItem.state.key!;
    }
    this.setState({ isDraggedItemOutside: isOutside });
  }

  // Handle dragging an item from the same grid over another item from the same grid
  private _onDragOverItem(key: string) {
    const children = [...(this.state.draggedChildren ?? this.state.children)];
    const draggedIdx = children.findIndex((child) => child === this._draggedGridItem);
    const draggedOverIdx = children.findIndex((child) => child.state.key === key);

    if (draggedIdx === -1 || draggedOverIdx === -1 || draggedIdx === draggedOverIdx) {
      this._lastDropTargetGridItemKey = key;
      return;
    }

    children.splice(draggedIdx, 1);
    children.splice(draggedOverIdx, 0, this._draggedGridItem!);
    this._lastDropTargetGridItemKey = this._draggedGridItem!.state.key!;

    this.setState({ draggedChildren: children });
  }

  private _updatePanelPosition(top: number, left: number) {
    this._setContainerStyle(DRAGGED_ITEM_TOP, `${top}px`);
    this._setContainerStyle(DRAGGED_ITEM_LEFT, `${left}px`);
  }

  private _updatePanelSize(width: number, height: number) {
    this._setContainerStyle(DRAGGED_ITEM_WIDTH, `${Math.floor(width)}px`);
    this._setContainerStyle(DRAGGED_ITEM_HEIGHT, `${Math.floor(height)}px`);
  }

  private _resetPanelPositionAndSize() {
    this._removeContainerStyle(DRAGGED_ITEM_TOP);
    this._removeContainerStyle(DRAGGED_ITEM_LEFT);
    this._removeContainerStyle(DRAGGED_ITEM_WIDTH);
    this._removeContainerStyle(DRAGGED_ITEM_HEIGHT);
  }

  private _setContainerStyle(name: string, value: string) {
    this.containerRef.current?.style.setProperty(name, value);
  }

  private _removeContainerStyle(name: string) {
    this.containerRef.current?.style.removeProperty(name);
  }
}
