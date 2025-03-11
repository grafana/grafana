import { CSSProperties, PointerEvent } from 'react';

import { SceneObject, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';

import { LayoutOrchestrator } from '../layout-manager/LayoutOrchestrator';
import { DropZone, getClosest, Point, Rect, SceneLayout2 } from '../layout-manager/utils';
import { DashboardLayoutItem } from '../types/DashboardLayoutItem';

import { ResponsiveGridItem } from './ResponsiveGridItem';
import { ResponsiveGridRenderer } from './ResponsiveGridLayoutRenderer';

export interface ResponsiveGridLayoutState extends SceneObjectState, ResponsiveGridLayoutOptions {
  children: ResponsiveGridItem[];
  /**
   * True when the item should rendered but not visible.
   * Useful for conditional display of layout items
   */
  isHidden?: boolean;
  /**
   * For media query for sceens smaller than md breakpoint
   */
  md?: ResponsiveGridLayoutOptions;
  /** True when the items should be lazy loaded */
  isLazy?: boolean;
}

export interface ResponsiveGridLayoutOptions {
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

export class ResponsiveGridLayout extends SceneObjectBase<ResponsiveGridLayoutState> implements SceneLayout2 {
  public layoutOrchestrator: LayoutOrchestrator | undefined;

  public static Component = ResponsiveGridRenderer;

  public constructor(state: Partial<ResponsiveGridLayoutState>) {
    super({
      rowGap: 1,
      columnGap: 1,
      templateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
      autoRows: state.autoRows ?? `320px`,
      children: state.children ?? [],
      ...state,
    });

    this.addActivationHandler(this.activationHandler);
  }

  private activationHandler = () => {
    this.layoutOrchestrator = findLayoutOrchestrator(this);
  };

  public isDraggable(): boolean {
    return true;
  }

  public getDragClass() {
    return `grid-drag-handle-${this.state.key}`;
  }

  public getDragClassCancel() {
    return 'grid-drag-cancel';
  }

  public getDragHooks = () => {
    return { onDragStart: this.onPointerDown };
  };

  public onPointerDown = (e: PointerEvent, panel: VizPanel) => {
    // const noContainer = !this.container;
    const cannotDrag = this.cannotDrag(e.target);
    if (cannotDrag || !this.layoutOrchestrator) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    this.layoutOrchestrator.onDragStart(e.nativeEvent, panel);
  };

  private cannotDrag(el: EventTarget) {
    const dragClass = this.getDragClass();
    const dragCancelClass = this.getDragClassCancel();

    // cancel dragging if the element being interacted with has an ancestor with the drag cancel class set
    // or if the drag class isn't set on an ancestor
    return el instanceof Element && (el.closest(`.${dragCancelClass}`) || !el.closest(`.${dragClass}`));
  }

  private container: HTMLElement | undefined;
  public setContainer(el: HTMLElement) {
    this.container = el;
  }

  public getContainer() {
    return this.container;
  }

  public activeOrder: number | undefined;

  /**
   * Find the drop zone in this layout closest to the provided `point`.
   * This gets called every tick while a layout item is being dragged, so we use the grid item's cached bbox,
   * calculated whenever the layout changes, rather than calculating them every time the cursor position changes.
   */
  public closestDropZone(point: Point): DropZone {
    let minDistance = Number.POSITIVE_INFINITY;
    let closestRect: Rect = { top: 0, bottom: 0, left: 0, right: 0 };

    let closestIndex: number | undefined;
    this.state.children.forEach((gridItem, i) => {
      const distance = gridItem.distanceToPoint(point);
      if (distance < minDistance && gridItem.cachedBoundingBox) {
        minDistance = distance;
        closestRect = gridItem.cachedBoundingBox;
        closestIndex = i;
      }
    });

    this.activeOrder = closestIndex;

    return { ...closestRect, distanceToPoint: minDistance };
  }

  // public calculateDropZones() {
  //   if (!this.container) {
  //     return [];
  //   }

  //   const visibleBoundingBoxes = this.state.children
  //     .map((layoutItem) => layoutItem.cachedBoundingBox)
  //     .filter((layoutItem) => layoutItem !== undefined);

  //   // If there are no visible children, temporarily add one to calculate dimensions
  //   if (!visibleBoundingBoxes.length) {
  //     const child = this.container.appendChild(document.createElement('div'));
  //     child.setAttribute('data-order', '99999');
  //     const gridCells = calculateGridCells(this.container).filter((c) => c.order >= 0);
  //     this.container.removeChild(child);
  //     return gridCells;
  //   }

  //   return calculateGridCells(this.container).filter((c) => c.order >= 0);
  // }

  importLayoutItem(layoutItem: DashboardLayoutItem): void {
    const layoutItemIR = layoutItem.toIntermediate();
    const layoutChildren = [...this.state.children];

    if (layoutItemIR.order !== undefined) {
      layoutItemIR.body.clearParent();

      const newLayoutItem = new ResponsiveGridItem({ body: layoutItemIR.body });
      layoutChildren.splice(layoutItemIR.order, 0, newLayoutItem);
    } else {
      // need to calculate splice index based on IR layout item bbox relative to other layout items
      console.warn('Not implemented');
    }

    this.setState({
      children: layoutChildren,
    });
  }

  removeLayoutItem(layoutItem: DashboardLayoutItem): void {
    this.setState({
      children: this.state.children.filter((c) => c !== layoutItem),
    });

    layoutItem.clearParent();
  }
}

function getGridStyles(gridElement: HTMLElement) {
  const gridStyles = getComputedStyle(gridElement);

  return {
    templateRows: gridStyles.gridTemplateRows.split(' ').map((row) => parseFloat(row)),
    templateColumns: gridStyles.gridTemplateColumns.split(' ').map((col) => parseFloat(col)),
    rowGap: parseFloat(gridStyles.rowGap),
    columnGap: parseFloat(gridStyles.columnGap),
  };
}

export interface GridCell extends Rect {
  order: number;
  rowIndex: number;
  columnIndex: number;
}

export function calculateGridCells(gridElement: HTMLElement) {
  const { templateRows, templateColumns, rowGap, columnGap } = getGridStyles(gridElement);
  const gridBoundingBox = gridElement.getBoundingClientRect();
  const { scrollTop } = closestScroll(gridElement);
  const gridOrigin = { x: gridBoundingBox.left, y: gridBoundingBox.top + scrollTop };
  const ids = [...gridElement.children]
    .map((c, i) => Number.parseInt(c.getAttribute('data-order') ?? `${i}`, 10))
    .filter((v) => v >= 0);

  const gridCells: GridCell[] = [];
  let yTotal = gridOrigin.y;
  for (let rowIndex = 0; rowIndex < templateRows.length; rowIndex++) {
    const height = templateRows[rowIndex];
    const row = {
      top: yTotal,
      bottom: yTotal + height,
    };
    yTotal = row.bottom + rowGap;

    let xTotal = gridOrigin.x;
    for (let colIndex = 0; colIndex < templateColumns.length; colIndex++) {
      const width = templateColumns[colIndex];
      const column = {
        left: xTotal,
        right: xTotal + width,
      };

      xTotal = column.right + columnGap;
      gridCells.push({
        left: column.left,
        right: column.right,
        top: row.top,
        bottom: row.bottom,
        rowIndex: rowIndex + 1,
        columnIndex: colIndex + 1,
        order: ids[rowIndex * templateColumns.length + colIndex],
      });
    }
  }

  return gridCells;
}

function canScroll(el: HTMLElement) {
  const oldScroll = el.scrollTop;
  el.scrollTop = Number.MAX_SAFE_INTEGER;
  const newScroll = el.scrollTop;
  el.scrollTop = oldScroll;

  return newScroll > 0;
}

function closestScroll(el?: HTMLElement | null): {
  scrollTop: number;
  scrollTopMax: number;
  wrapper?: HTMLElement | null;
} {
  if (el && canScroll(el)) {
    return { scrollTop: el.scrollTop, scrollTopMax: el.scrollHeight - el.clientHeight - 5, wrapper: el };
  }

  return el ? closestScroll(el.parentElement) : { scrollTop: 0, scrollTopMax: 0, wrapper: el };
}

function findLayoutOrchestrator(root: SceneObject | undefined) {
  if (!root) {
    return undefined;
  }

  return getClosest(root, (s) => (s instanceof LayoutOrchestrator ? s : undefined));
}
