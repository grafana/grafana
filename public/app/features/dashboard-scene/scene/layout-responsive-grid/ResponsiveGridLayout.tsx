import { createRef, CSSProperties, PointerEvent } from 'react';

import { SceneObject, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';

import { LayoutOrchestrator } from '../layout-manager/LayoutOrchestrator';
import { DropZone, getClosest, Point, Rect, SceneLayout2 } from '../layout-manager/utils';
import { DashboardLayoutItem } from '../types/DashboardLayoutItem';

import { ResponsiveGridItem } from './ResponsiveGridItem';
import { ResponsiveGridLayoutRenderer } from './ResponsiveGridLayoutRenderer';

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

  public static Component = ResponsiveGridLayoutRenderer;

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

  public containerRef = createRef<HTMLDivElement>();
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

  public activeIndex: number | undefined;
  public activeGridCell = { row: 1, column: 1 };
  public columnCount = 1;
  // maybe not needed?
  public rowCount = 1;

  /**
   * Find the drop zone in this layout closest to the provided `point`.
   * This gets called every tick while a layout item is being dragged, so we use the grid item's cached bbox,
   * calculated whenever the layout changes, rather than calculating them every time the cursor position changes.
   */
  public closestDropZone(point: Point): DropZone {
    let minDistance = Number.POSITIVE_INFINITY;
    let closestRect: Rect = { top: 0, bottom: 0, left: 0, right: 0 };

    let closestIndex: number | undefined;
    let closest = { row: 1, column: 1 };
    this.state.children.forEach((gridItem, i) => {
      let curColumn = i % this.columnCount;
      let curRow = Math.floor(i / this.columnCount);
      const distance = gridItem.distanceToPoint(point);
      if (distance < minDistance && gridItem.cachedBoundingBox) {
        minDistance = distance;
        closestRect = gridItem.cachedBoundingBox;
        closestIndex = i;
        // css grid rows/columns are 1-indexed
        closest = { row: curRow + 1, column: curColumn + 1 };
      }
    });

    this.activeIndex = closestIndex;
    this.activeGridCell = closest;

    return { ...closestRect, distanceToPoint: minDistance };
  }

  importLayoutItem(layoutItem: DashboardLayoutItem): void {
    const layoutItemIR = layoutItem.toIntermediate();
    const layoutChildren = [...this.state.children];

    layoutItemIR.body.clearParent();

    const newLayoutItem = new ResponsiveGridItem({ body: layoutItemIR.body });
    layoutChildren.splice(this.activeIndex ?? 0, 0, newLayoutItem);

    this.setState({
      children: layoutChildren,
    });

    newLayoutItem.activate();
  }

  removeLayoutItem(layoutItem: DashboardLayoutItem): void {
    this.setState({
      children: this.state.children.filter((c) => c !== layoutItem),
    });

    layoutItem.clearParent();
  }
}

export interface GridCell extends Rect {
  order: number;
  rowIndex: number;
  columnIndex: number;
}

function findLayoutOrchestrator(root: SceneObject | undefined) {
  if (!root) {
    return undefined;
  }

  return getClosest(root, (s) => (s instanceof LayoutOrchestrator ? s : undefined));
}
