import { createRef, CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

import { SceneLayout, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';

import { isRepeatCloneOrChildOf } from '../../utils/clone';
import { getLayoutOrchestratorFor } from '../../utils/utils';

import { AutoGridItem } from './AutoGridItem';
import { AutoGridLayoutRenderer } from './AutoGridLayoutRenderer';
import { DRAGGED_ITEM_HEIGHT, DRAGGED_ITEM_LEFT, DRAGGED_ITEM_TOP, DRAGGED_ITEM_WIDTH } from './const';

export interface AutoGridLayoutState extends SceneObjectState, AutoGridLayoutOptions {
  children: AutoGridItem[];

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
}

export interface AutoGridLayoutOptions {
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
      document.body.removeEventListener('pointermove', this._onDrag);
      document.body.removeEventListener('pointerup', this._onDragEnd);
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
    return {
      onDragStart: this._onDragStart,
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
  private _onDragStart(evt: ReactPointerEvent, panel: VizPanel) {
    if (!this._canDrag(evt)) {
      return;
    }

    evt.preventDefault();
    evt.stopPropagation();

    if (!(panel.parent instanceof AutoGridItem)) {
      throw new Error('Dragging wrong item');
    }

    this._draggedGridItem = panel.parent;

    const { top, left, width, height } = this._draggedGridItem.getBoundingBox();
    this._initialGridItemPosition = { pageX: evt.pageX, pageY: evt.pageY, top, left: left };
    this._updatePanelSize(width, height);
    this._updatePanelPosition(top, left);

    this.setState({ draggingKey: this._draggedGridItem.state.key });

    document.body.addEventListener('pointermove', this._onDrag);
    document.body.addEventListener('pointerup', this._onDragEnd);
    document.body.classList.add('dashboard-draggable-transparent-selection');

    getLayoutOrchestratorFor(this)?.startDraggingSync(evt, panel);
  }

  // Stop inside dragging
  private _onDragEnd() {
    window.getSelection()?.removeAllRanges();

    this._draggedGridItem = null;
    this._initialGridItemPosition = null;
    this._resetPanelPositionAndSize();

    this.setState({ draggingKey: undefined });

    document.body.removeEventListener('pointermove', this._onDrag);
    document.body.removeEventListener('pointerup', this._onDragEnd);
    document.body.classList.remove('dashboard-draggable-transparent-selection');
  }

  // Handle inside drag moves
  private _onDrag(evt: PointerEvent) {
    if (!this._draggedGridItem || !this._initialGridItemPosition) {
      this._onDragEnd();
      return;
    }

    this._updatePanelPosition(
      this._initialGridItemPosition.top + (evt.pageY - this._initialGridItemPosition.pageY),
      this._initialGridItemPosition.left + (evt.pageX - this._initialGridItemPosition.pageX)
    );

    const dropTargetGridItemKey = document
      .elementsFromPoint(evt.clientX, evt.clientY)
      ?.find((element) => {
        const key = element.getAttribute('data-auto-grid-item-drop-target');

        return !!key && key !== this._draggedGridItem!.state.key;
      })
      ?.getAttribute('data-auto-grid-item-drop-target');

    if (dropTargetGridItemKey) {
      this._onDragOverItem(dropTargetGridItemKey);
    }
  }

  // Handle dragging an item from the same grid over another item from the same grid
  private _onDragOverItem(key: string) {
    const children = [...this.state.children];
    const draggedIdx = children.findIndex((child) => child === this._draggedGridItem);
    const draggedOverIdx = children.findIndex((child) => child.state.key === key);

    if (draggedIdx === -1 || draggedOverIdx === -1) {
      return;
    }

    children.splice(draggedIdx, 1);
    children.splice(draggedOverIdx, 0, this._draggedGridItem!);

    this.setState({ children });
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
