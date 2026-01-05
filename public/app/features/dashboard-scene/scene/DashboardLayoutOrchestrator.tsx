import { css } from '@emotion/css';
import { PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';

import { GrafanaTheme2 } from '@grafana/data';
import { logWarning } from '@grafana/runtime';
import {
  sceneGraph,
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  VizPanel,
  SceneGridItemLike,
} from '@grafana/scenes';
import { createPointerDistance, useStyles2 } from '@grafana/ui';

import { DashboardScene } from './DashboardScene';
import { RowItem } from './layout-rows/RowItem';
import { RowsLayoutManager } from './layout-rows/RowsLayoutManager';
import { TabItem } from './layout-tabs/TabItem';
import { TabsLayoutManager } from './layout-tabs/TabsLayoutManager';
import { DashboardDropTarget, isDashboardDropTarget } from './types/DashboardDropTarget';

const TAB_ACTIVATION_DELAY_MS = 600;

interface DashboardLayoutOrchestratorState extends SceneObjectState {
  /** Grid item currently being dragged */
  draggingGridItem?: SceneObjectRef<SceneGridItemLike>;
  /** Row currently being dragged */
  draggingRow?: SceneObjectRef<RowItem>;
  /** Key of the source tab where drag started */
  sourceTabKey?: string;
  /** Key of the tab currently being hovered during drag */
  hoverTabKey?: string;
  /** Preview state for cross-tab drag */
  dragPreview?: {
    x: number;
    y: number;
    width: number;
    height: number;
    /** Offset from cursor to top-left of preview (preserves click position) */
    offsetX: number;
    offsetY: number;
    label: string;
    type: 'panel' | 'row';
  };
}

export class DashboardLayoutOrchestrator extends SceneObjectBase<DashboardLayoutOrchestratorState> {
  public static Component = DragPreviewRenderer;

  private _sourceDropTarget: DashboardDropTarget | null = null;
  private _lastDropTarget: DashboardDropTarget | null = null;
  private _pointerDistance = createPointerDistance();
  private _isSelectedObject = false;
  private _tabActivationTimer: ReturnType<typeof setTimeout> | null = null;
  private _lastHoveredTabKey: string | null = null;
  /** Track if item was detached from source during cross-tab drag */
  private _itemDetachedFromSource = false;
  /** Cached label for the preview */
  private _previewLabel = '';
  /** Cached type for the preview */
  private _previewType: 'panel' | 'row' = 'panel';
  /** Cached dimensions for the preview */
  private _previewWidth = 0;
  private _previewHeight = 0;
  /** Last known cursor position */
  private _lastCursorX = 0;
  private _lastCursorY = 0;
  /** Offset from cursor to item's top-left corner (captured on drag start) */
  private _dragOffsetX = 0;
  private _dragOffsetY = 0;
  /** Source layout manager for row drag (for removal before tab switch) */
  private _sourceRowsLayout: RowsLayoutManager | null = null;
  /** Flag to track if row drag offset has been captured */
  private _rowOffsetCaptured = false;

  public constructor() {
    super({});

    this._onPointerMove = this._onPointerMove.bind(this);
    this._stopDraggingSync = this._stopDraggingSync.bind(this);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    return () => {
      document.body.removeEventListener('pointermove', this._onPointerMove);
      document.body.removeEventListener('pointermove', this._onRowDragPointerMove);
      document.body.removeEventListener('pointerup', this._stopDraggingSync);
      document.body.removeEventListener('pointerup', this._onRowDragPointerUp);
      this._clearTabActivationTimer();
    };
  }

  /**
   * Returns true if any drag operation is in progress (grid item or row)
   */
  public isDragging(): boolean {
    return !!(this.state.draggingGridItem || this.state.draggingRow);
  }

  public startDraggingSync(evt: ReactPointerEvent, gridItem: SceneGridItemLike): void {
    this._pointerDistance.set(evt);
    this._isSelectedObject = false;

    const dropTarget = sceneGraph.findObject(gridItem, isDashboardDropTarget);

    if (!dropTarget || !isDashboardDropTarget(dropTarget)) {
      return;
    }

    this._sourceDropTarget = dropTarget;
    this._lastDropTarget = dropTarget;

    // Capture the offset from cursor to item's top-left corner
    this._captureDragOffset(evt.clientX, evt.clientY, gridItem);

    document.body.addEventListener('pointermove', this._onPointerMove);
    document.body.addEventListener('pointerup', this._stopDraggingSync);

    const sourceTabKey = this._findParentTabKey(gridItem);
    this.setState({ draggingGridItem: gridItem.getRef(), sourceTabKey });
  }

  private _stopDraggingSync(_evt: PointerEvent) {
    const gridItem = this.state.draggingGridItem?.resolve();
    const wasDetached = this._itemDetachedFromSource;
    // Capture these before cleanup since setTimeout runs after cleanup
    const sourceDropTarget = this._sourceDropTarget;
    const lastDropTarget = this._lastDropTarget;

    // Handle cross-layout or cross-tab drop
    if (sourceDropTarget !== lastDropTarget || wasDetached) {
      // Wrapped in setTimeout to ensure that any event handlers are called
      // Useful for allowing react-grid-layout to remove placeholders, etc.
      setTimeout(() => {
        if (gridItem) {
          // Only remove from source if not already detached during tab switch
          if (!wasDetached) {
            sourceDropTarget?.draggedGridItemOutside?.(gridItem);
          }
          lastDropTarget?.draggedGridItemInside?.(gridItem);
        } else {
          const warningMessage = 'No grid item to drag';
          console.warn(warningMessage);
          logWarning(warningMessage);
        }
      });
    }

    document.body.removeEventListener('pointermove', this._onPointerMove);
    document.body.removeEventListener('pointerup', this._stopDraggingSync);

    this._clearTabActivationTimer();
    this._clearDragPreview();
    this._lastDropTarget?.setIsDropTarget?.(false);
    this._lastDropTarget = null;
    this._sourceDropTarget = null;
    this._itemDetachedFromSource = false;
    this.setState({ draggingGridItem: undefined, sourceTabKey: undefined, hoverTabKey: undefined });
  }

  /**
   * Called when a row drag starts (from RowsLayoutManagerRenderer)
   */
  public startRowDrag(row: RowItem): void {
    const sourceTabKey = this._findParentTabKey(row);

    // Store source layout info for removal before tab switch
    const parent = row.parent;
    if (parent instanceof RowsLayoutManager) {
      this._sourceRowsLayout = parent;
    }

    // Capture row dimensions
    this._captureRowDimensions(row);

    // Offset will be captured on first pointermove
    this._rowOffsetCaptured = false;

    this.setState({
      draggingRow: row.getRef(),
      sourceTabKey,
    });

    // Add pointer move listener for tab hover detection during row drag
    document.body.addEventListener('pointermove', this._onRowDragPointerMove);
    // Add pointerup listener to handle drop after cross-tab switch
    document.body.addEventListener('pointerup', this._onRowDragPointerUp);
  }

  private _onRowDragPointerMove = (evt: PointerEvent): void => {
    // Capture row offset on first move (we don't have cursor position at drag start)
    if (!this._rowOffsetCaptured) {
      const row = this.state.draggingRow?.resolve();
      if (row) {
        this._captureRowDragOffset(evt.clientX, evt.clientY, row);
        this._rowOffsetCaptured = true;
      }
    }

    // Store cursor position early so it's available for immediate preview on tab switch
    this._lastCursorX = evt.clientX;
    this._lastCursorY = evt.clientY;

    this._checkTabHover(evt.clientX, evt.clientY);
    this._updateDragPreview(evt.clientX, evt.clientY);
  };

  private _onRowDragPointerUp = (_evt: PointerEvent): void => {
    // Handle drop after cross-tab row drag
    if (this._itemDetachedFromSource) {
      const row = this.state.draggingRow?.resolve();
      if (row) {
        // Find the drop target under cursor and add row to it
        const dropTarget = this._lastDropTarget ?? this._getDropTargetUnderMouse(_evt);
        if (dropTarget instanceof TabItem) {
          dropTarget.acceptDroppedRow?.(row);
        }
      }
    }

    // Clean up - this will be called in addition to stopRowDrag from hello-pangea/dnd
    // but only if the drag was detached
    if (this._itemDetachedFromSource) {
      this._finalizeRowDrag();
    }
  };

  /**
   * Called when a row drag ends (from RowsLayoutManagerRenderer)
   * This is called by hello-pangea/dnd when drag ends normally (within same layout)
   * For cross-tab drags, the row is already detached and _onRowDragPointerUp handles the drop
   */
  public stopRowDrag(): void {
    // If the row was detached (cross-tab drag), don't clean up yet
    // The pointerup handler will handle cleanup after drop
    if (this._itemDetachedFromSource) {
      return;
    }

    this._finalizeRowDrag();
  }

  private _finalizeRowDrag(): void {
    document.body.removeEventListener('pointermove', this._onRowDragPointerMove);
    document.body.removeEventListener('pointerup', this._onRowDragPointerUp);
    this._clearTabActivationTimer();
    this._clearDragPreview();
    this._lastDropTarget?.setIsDropTarget?.(false);
    this._lastDropTarget = null;
    this._sourceDropTarget = null;
    this._itemDetachedFromSource = false;
    this._sourceRowsLayout = null;
    this._rowOffsetCaptured = false;
    this.setState({
      draggingRow: undefined,
      sourceTabKey: undefined,
      hoverTabKey: undefined,
    });
  }

  private _clearTabActivationTimer(): void {
    if (this._tabActivationTimer) {
      clearTimeout(this._tabActivationTimer);
      this._tabActivationTimer = null;
    }
  }

  private _updateDragPreview(x: number, y: number): void {
    // Store cursor position for immediate preview on tab switch
    this._lastCursorX = x;
    this._lastCursorY = y;

    if (this._itemDetachedFromSource) {
      this.setState({
        dragPreview: {
          x,
          y,
          width: this._previewWidth,
          height: this._previewHeight,
          offsetX: this._dragOffsetX,
          offsetY: this._dragOffsetY,
          label: this._previewLabel,
          type: this._previewType,
        },
      });
    }
  }

  private _showDragPreview(): void {
    // Prevent text selection and set move cursor during cross-tab drag
    document.body.classList.add('dashboard-draggable-transparent-selection');
    document.body.classList.add('dragging-active');

    this.setState({
      dragPreview: {
        x: this._lastCursorX,
        y: this._lastCursorY,
        width: this._previewWidth,
        height: this._previewHeight,
        offsetX: this._dragOffsetX,
        offsetY: this._dragOffsetY,
        label: this._previewLabel,
        type: this._previewType,
      },
    });
  }

  private _captureDragOffset(cursorX: number, cursorY: number, gridItem: SceneGridItemLike): void {
    // Try to use containerRef if available
    if ('containerRef' in gridItem) {
      const containerRef = gridItem.containerRef;
      if (
        containerRef &&
        typeof containerRef === 'object' &&
        'current' in containerRef &&
        containerRef.current instanceof HTMLElement
      ) {
        const rect = containerRef.current.getBoundingClientRect();
        // Offset is cursor position minus item's top-left
        this._dragOffsetX = cursorX - rect.left;
        this._dragOffsetY = cursorY - rect.top;
        return;
      }
    }

    // Fallback: try to find by data attribute
    const element = document.querySelector(`[data-griditem-key="${gridItem.state.key}"]`);
    if (element) {
      const rect = element.getBoundingClientRect();
      this._dragOffsetX = cursorX - rect.left;
      this._dragOffsetY = cursorY - rect.top;
      return;
    }

    // Fallback: center the preview on cursor
    this._dragOffsetX = 0;
    this._dragOffsetY = 0;
  }

  private _captureItemDimensions(gridItem: SceneGridItemLike): void {
    // Try to use containerRef if available (both DashboardGridItem and AutoGridItem have it)
    if ('containerRef' in gridItem) {
      const containerRef = gridItem.containerRef;
      if (
        containerRef &&
        typeof containerRef === 'object' &&
        'current' in containerRef &&
        containerRef.current instanceof HTMLElement
      ) {
        const rect = containerRef.current.getBoundingClientRect();
        this._previewWidth = rect.width;
        this._previewHeight = rect.height;
        return;
      }
    }

    // Fallback: try to find the DOM element by data attribute
    const element = document.querySelector(`[data-griditem-key="${gridItem.state.key}"]`);
    if (element) {
      const rect = element.getBoundingClientRect();
      this._previewWidth = rect.width;
      this._previewHeight = rect.height;
      return;
    }

    // Fallback to reasonable default
    this._previewWidth = 400;
    this._previewHeight = 300;
  }

  private _captureRowDimensions(row: RowItem): void {
    // Try to find the DOM element for the row using data-dashboard-drop-target-key
    const element = document.querySelector(`[data-dashboard-drop-target-key="${row.state.key}"]`);
    if (element) {
      const rect = element.getBoundingClientRect();
      this._previewWidth = rect.width;
      this._previewHeight = rect.height;
      return;
    }

    // Fallback to reasonable default for rows
    this._previewWidth = 800;
    this._previewHeight = 48;
  }

  private _captureRowDragOffset(cursorX: number, cursorY: number, row: RowItem): void {
    // Try to find the DOM element for the row
    const element = document.querySelector(`[data-dashboard-drop-target-key="${row.state.key}"]`);
    if (element) {
      const rect = element.getBoundingClientRect();
      this._dragOffsetX = cursorX - rect.left;
      this._dragOffsetY = cursorY - rect.top;
      return;
    }

    // Fallback: use small offset
    this._dragOffsetX = 20;
    this._dragOffsetY = 20;
  }

  private _clearDragPreview(): void {
    // Re-enable text selection and reset cursor
    document.body.classList.remove('dashboard-draggable-transparent-selection');
    document.body.classList.remove('dragging-active');
    window.getSelection()?.removeAllRanges();

    if (this.state.dragPreview) {
      this.setState({ dragPreview: undefined });
    }
  }

  private _checkTabHover(clientX: number, clientY: number): void {
    const tabKey = this._getTabUnderMouse(clientX, clientY);

    if (tabKey !== this._lastHoveredTabKey) {
      // Cursor moved to a different tab or left all tabs
      this._clearTabActivationTimer();
      this._lastHoveredTabKey = tabKey;

      if (tabKey) {
        // Check if this tab is already active - no need to switch
        if (this._isTabAlreadyActive(tabKey)) {
          this.setState({ hoverTabKey: undefined });
          return;
        }

        // Start new timer for the new tab
        this._tabActivationTimer = setTimeout(() => {
          this._activateTab(tabKey);
        }, TAB_ACTIVATION_DELAY_MS);

        this.setState({ hoverTabKey: tabKey });
      } else {
        this.setState({ hoverTabKey: undefined });
      }
    }
  }

  private _isTabAlreadyActive(tabKey: string): boolean {
    const dashboard = this._getDashboard();
    const tabItem = sceneGraph.findByKey(dashboard, tabKey);

    if (tabItem instanceof TabItem) {
      const tabsManager = tabItem.getParentLayout();
      if (tabsManager instanceof TabsLayoutManager) {
        const currentTab = tabsManager.getCurrentTab();
        return currentTab === tabItem;
      }
    }
    return false;
  }

  private _activateTab(tabKey: string): void {
    const dashboard = this._getDashboard();
    const tabItem = sceneGraph.findByKey(dashboard, tabKey);

    if (tabItem instanceof TabItem) {
      const tabsManager = tabItem.getParentLayout();
      if (tabsManager instanceof TabsLayoutManager) {
        // For grid items: remove from source BEFORE switching tabs
        // This prevents the item from being unmounted with the source tab
        const gridItem = this.state.draggingGridItem?.resolve();
        if (gridItem && this._sourceDropTarget && !this._itemDetachedFromSource) {
          // Get label and dimensions for preview before detaching
          this._previewLabel = this._getItemLabel(gridItem);
          this._previewType = 'panel';
          this._captureItemDimensions(gridItem);

          this._sourceDropTarget.draggedGridItemOutside?.(gridItem);
          this._itemDetachedFromSource = true;

          // Show preview immediately using last known cursor position
          this._showDragPreview();
        }

        // For rows: remove from source layout and show preview
        const row = this.state.draggingRow?.resolve();
        if (row && !this._itemDetachedFromSource && this._sourceRowsLayout) {
          // Get label for preview (dimensions already captured in startRowDrag)
          this._previewLabel = row.state.title || 'Row';
          this._previewType = 'row';

          // Remove row from source layout (skip undo as this is part of drag operation)
          this._sourceRowsLayout.removeRow(row, true);
          this._itemDetachedFromSource = true;

          // Show preview immediately
          this._showDragPreview();
        }

        tabsManager.switchToTab(tabItem);

        // Update last drop target to the new tab
        // This ensures drop works even if user releases immediately after tab switch
        if (isDashboardDropTarget(tabItem)) {
          this._lastDropTarget = tabItem;
        }
      }
    }
  }

  private _getItemLabel(gridItem: SceneGridItemLike): string {
    if ('state' in gridItem && 'body' in gridItem.state && gridItem.state.body instanceof VizPanel) {
      return gridItem.state.body.state.title || 'Panel';
    }
    return 'Panel';
  }

  private _getTabUnderMouse(clientX: number, clientY: number): string | null {
    const elementsUnderPoint = document.elementsFromPoint(clientX, clientY);

    const tabKey = elementsUnderPoint
      ?.find((element) => element.getAttribute('data-tab-activation-key'))
      ?.getAttribute('data-tab-activation-key');

    return tabKey || null;
  }

  private _findParentTabKey(item: RowItem | SceneGridItemLike): string | undefined {
    let parent = item.parent;
    while (parent) {
      if (parent instanceof TabItem) {
        return parent.state.key;
      }
      parent = parent.parent;
    }
    return undefined;
  }

  private _onPointerMove(evt: PointerEvent) {
    // Store cursor position early so it's available for immediate preview on tab switch
    this._lastCursorX = evt.clientX;
    this._lastCursorY = evt.clientY;

    if (!this._isSelectedObject && this.state.draggingGridItem && this._pointerDistance.check(evt)) {
      this._isSelectedObject = true;
      const gridItem = this.state.draggingGridItem?.resolve();
      if (gridItem && 'state' in gridItem && 'body' in gridItem.state && gridItem.state.body instanceof VizPanel) {
        const panel = gridItem.state.body;
        this._getDashboard().state.editPane.selectObject(panel, panel.state.key!, { force: true, multi: false });
      }
    }

    // Check for tab hover to enable tab switching during drag
    this._checkTabHover(evt.clientX, evt.clientY);

    // Update drag preview position if item is detached
    this._updateDragPreview(evt.clientX, evt.clientY);

    const dropTarget = this._getDropTargetUnderMouse(evt) ?? this._sourceDropTarget;

    if (!dropTarget) {
      return;
    }

    if (dropTarget !== this._lastDropTarget) {
      this._lastDropTarget?.setIsDropTarget?.(false);
      this._lastDropTarget = dropTarget;

      if (dropTarget !== this._sourceDropTarget) {
        dropTarget.setIsDropTarget?.(true);
      }
    }
  }

  private _getDashboard(): DashboardScene {
    if (!(this.parent instanceof DashboardScene)) {
      throw new Error('Parent is not a DashboardScene');
    }

    return this.parent;
  }

  private _getDropTargetUnderMouse(evt: MouseEvent): DashboardDropTarget | null {
    const elementsUnderPoint = document.elementsFromPoint(evt.clientX, evt.clientY);
    const cursorIsInSourceTarget = elementsUnderPoint.some(
      (el) => el.getAttribute('data-dashboard-drop-target-key') === this._sourceDropTarget?.state.key
    );

    if (cursorIsInSourceTarget) {
      return null;
    }

    const key = elementsUnderPoint
      ?.find((element) => element.getAttribute('data-dashboard-drop-target-key'))
      ?.getAttribute('data-dashboard-drop-target-key');

    if (!key) {
      return null;
    }

    const sceneObject = sceneGraph.findByKey(this._getDashboard(), key);

    if (!sceneObject || !isDashboardDropTarget(sceneObject)) {
      return null;
    }

    return sceneObject;
  }
}

/**
 * Renders a floating drag preview when an item is detached during cross-tab drag
 */
function DragPreviewRenderer({ model }: SceneComponentProps<DashboardLayoutOrchestrator>) {
  const { dragPreview } = model.useState();
  const styles = useStyles2(getPreviewStyles);

  if (!dragPreview) {
    return null;
  }

  // Position preview so cursor maintains same relative position as when drag started
  const previewLeft = dragPreview.x - dragPreview.offsetX;
  const previewTop = dragPreview.y - dragPreview.offsetY;

  const preview = (
    <div
      className={styles.preview}
      style={{
        left: previewLeft,
        top: previewTop,
        width: dragPreview.width,
        height: dragPreview.height,
      }}
    >
      <span className={styles.label}>{dragPreview.label}</span>
    </div>
  );

  return createPortal(preview, document.body);
}

const getPreviewStyles = (theme: GrafanaTheme2) => ({
  preview: css({
    position: 'fixed',
    background: theme.colors.background.primary,
    border: `1px dashed ${theme.colors.primary.main}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    pointerEvents: 'none',
    zIndex: theme.zIndex.tooltip,
    overflow: 'hidden',
    opacity: 0.9,
  }),
  label: css({
    // Match panel header styling
    display: 'flex',
    alignItems: 'center',
    height: theme.spacing(theme.components.panel.headerHeight),
    padding: theme.spacing(0.5, 1, 0, 1.5),
    color: theme.colors.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    ...theme.typography.h6,
  }),
});
