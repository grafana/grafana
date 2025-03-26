import { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

import { SceneLayout, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';

import { getLayoutOrchestratorFor } from '../../utils/utils';

import { AutoGridItem } from './ResponsiveGridItem';
import { AutoGridLayoutRenderer } from './ResponsiveGridLayoutRenderer';

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

  /** True when the items should be lazy loaded */
  isLazy?: boolean;

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

export class ResponsiveGridLayout extends SceneObjectBase<AutoGridLayoutState> implements SceneLayout {
  public static Component = AutoGridLayoutRenderer;

  private _draggedGridItem: AutoGridItem | null = null;
  private _draggedPosition: { top: number; left: number; width: number; height: number } | null = null;

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
  }

  public isDraggable(): boolean {
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
    this._draggedPosition = this._draggedGridItem.getBoundingBox();
    this._updatePanelPosition();

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
    this._draggedPosition = null;

    this.setState({ draggingKey: undefined });

    document.body.removeEventListener('pointermove', this._onDrag);
    document.body.removeEventListener('pointerup', this._onDragEnd);
    document.body.classList.remove('dashboard-draggable-transparent-selection');
  }

  // Handle inside drag moves
  private _onDrag(evt: PointerEvent) {
    if (!this._draggedGridItem || !this._draggedPosition) {
      this._onDragEnd();
      return;
    }

    evt.preventDefault();
    evt.stopPropagation();

    this._draggedPosition.top = this._draggedPosition.top + evt.movementY;
    this._draggedPosition.left = this._draggedPosition.left + evt.movementX;

    this._updatePanelPosition();

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

  private _updatePanelPosition() {
    if (!this._draggedPosition) {
      document.body.style.removeProperty(DRAGGED_ITEM_TOP);
      document.body.style.removeProperty(DRAGGED_ITEM_LEFT);
      document.body.style.removeProperty(DRAGGED_ITEM_WIDTH);
      document.body.style.removeProperty(DRAGGED_ITEM_HEIGHT);
      return;
    }

    document.body.style.setProperty(DRAGGED_ITEM_TOP, `${this._draggedPosition.top}px`);
    document.body.style.setProperty(DRAGGED_ITEM_LEFT, `${this._draggedPosition.left}px`);
    document.body.style.setProperty(DRAGGED_ITEM_WIDTH, `${this._draggedPosition.width}px`);
    document.body.style.setProperty(DRAGGED_ITEM_HEIGHT, `${this._draggedPosition.height}px`);
  }
}

export const DRAGGED_ITEM_TOP = '--responsive-grid-dragged-item-top';
export const DRAGGED_ITEM_LEFT = '--responsive-grid-dragged-item-left';
export const DRAGGED_ITEM_WIDTH = '--responsive-grid-dragged-item-width';
export const DRAGGED_ITEM_HEIGHT = '--responsive-grid-dragged-item-height';
