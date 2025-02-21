import React, { CSSProperties, MouseEvent } from 'react';

import { SceneLayout, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';

import { getLayoutOrchestratorFor } from '../../utils/utils';

import { ResponsiveGridItem } from './ResponsiveGridItem';
import { SceneCSSGridLayoutRenderer } from './SceneCSSGridLayoutRenderer';

export interface SceneCSSGridLayoutState extends SceneObjectState, SceneCSSGridLayoutOptions {
  children: ResponsiveGridItem[];
  isDraggable?: boolean;
  isHidden?: boolean;
  md?: SceneCSSGridLayoutOptions;
  isLazy?: boolean;
  isDragging?: boolean;
}

export interface SceneCSSGridLayoutOptions {
  autoRows?: CSSProperties['gridAutoRows'];
  templateRows?: CSSProperties['gridTemplateRows'];
  templateColumns: CSSProperties['gridTemplateColumns'];
  rowGap: number;
  columnGap: number;
  justifyItems?: CSSProperties['justifyItems'];
  alignItems?: CSSProperties['alignItems'];
  justifyContent?: CSSProperties['justifyContent'];
}

export class SceneCSSGridLayout extends SceneObjectBase<SceneCSSGridLayoutState> implements SceneLayout {
  public static Component = SceneCSSGridLayoutRenderer;

  private _draggedGridItem: ResponsiveGridItem | null = null;
  private _layoutRef: HTMLDivElement | null = null;

  public constructor(state: Partial<SceneCSSGridLayoutState>) {
    super({
      rowGap: 1,
      columnGap: 1,
      templateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
      autoRows: state.autoRows ?? '320px',
      children: state.children ?? [],
      isDraggable: true,
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

  public setLayoutRef(ref: HTMLDivElement | null) {
    this._layoutRef = ref;
  }

  // Handle dragging an item from the same grid over another item from the same grid
  public onDragOverItem(evt: MouseEvent, item: ResponsiveGridItem) {
    evt.preventDefault();
    evt.stopPropagation();

    if (!this._draggedGridItem) {
      return;
    }

    const children = [...this.state.children];
    const draggedIdx = children.findIndex((child) => child === this._draggedGridItem);
    const draggedOverIdx = children.findIndex((child) => child === item);

    if (draggedIdx === -1 || draggedOverIdx === -1) {
      return;
    }

    children.splice(draggedIdx, 1);
    children.splice(draggedOverIdx, 0, this._draggedGridItem);

    this.setState({ children });
  }

  // Start inside dragging
  private _onDragStart(evt: React.PointerEvent, panel: VizPanel) {
    evt.preventDefault();
    evt.stopPropagation();

    if (!(panel.parent instanceof ResponsiveGridItem)) {
      throw new Error('Dragging wrong item');
    }

    this._draggedGridItem = panel.parent;
    this._draggedGridItem.startDragging(this._layoutRef!.getBoundingClientRect());

    this.setState({ isDragging: true });

    document.body.addEventListener('pointermove', this._onDrag);
    document.body.addEventListener('pointerup', this._onDragEnd);
    document.body.classList.add('dashboard-draggable-transparent-selection');

    getLayoutOrchestratorFor(this)?.startDraggingSync(panel);
  }

  // Stop inside dragging
  private _onDragEnd(evt: PointerEvent) {
    evt.preventDefault();
    evt.stopPropagation();

    window.getSelection()?.removeAllRanges();

    this._draggedGridItem?.stopDragging();
    this._draggedGridItem = null;

    this.setState({ isDragging: false });

    document.body.removeEventListener('pointermove', this._onDrag);
    document.body.removeEventListener('pointerup', this._onDragEnd);
    document.body.classList.remove('dashboard-draggable-transparent-selection');
  }

  // Handle inside drag moves
  private _onDrag(evt: PointerEvent) {
    evt.preventDefault();
    evt.stopPropagation();

    this._draggedGridItem?.changeDraggingPosition(evt.movementX, evt.movementY);
  }
}
