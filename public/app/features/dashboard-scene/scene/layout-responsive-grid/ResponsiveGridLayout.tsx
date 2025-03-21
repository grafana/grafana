import { createRef, CSSProperties, PointerEvent } from 'react';

import { SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';

import { getDashboardSceneFor } from '../../utils/utils';
import { LayoutOrchestrator } from '../layout-manager/LayoutOrchestrator';
import { DropZone, Point, Rect, SceneLayoutWithDragAndDrop } from '../layout-manager/utils';
import { DashboardLayoutItem } from '../types/DashboardLayoutItem';

import { ResponsiveGridItem } from './ResponsiveGridItem';
import { ResponsiveGridLayoutRenderer } from './ResponsiveGridLayoutRenderer';

export interface ResponsiveGridLayoutState extends SceneObjectState, ResponsiveGridLayoutOptions {
  children: ResponsiveGridItem[];

  /**
   * True when the item should be rendered but not visible.
   * Useful for conditional display of layout items
   */
  isHidden?: boolean;

  /**
   * For media query for screens smaller than md breakpoint
   */
  md?: ResponsiveGridLayoutOptions;

  /** True when the items should be lazy loaded */
  isLazy?: boolean;

  /** True when the items should be draggable */
  isDraggable?: boolean;
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

export class ResponsiveGridLayout
  extends SceneObjectBase<ResponsiveGridLayoutState>
  implements SceneLayoutWithDragAndDrop
{
  public layoutOrchestrator: LayoutOrchestrator | undefined;

  public static Component = ResponsiveGridLayoutRenderer;

  public containerRef = createRef<HTMLDivElement>();

  public activeIndex: number | undefined;
  public activeGridCell = { row: 1, column: 1 };
  public columnCount = 1;
  // maybe not needed?
  public rowCount = 1;
  public scrollPos: ReturnType<typeof closestScroll> | undefined;

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
    this.layoutOrchestrator = getDashboardSceneFor(this).state.layoutOrchestrator;
  };

  public isDraggable(): boolean {
    return this.state.isDraggable ?? false;
  }

  public getDragClass(): string {
    return `grid-drag-handle-${this.state.key}`;
  }

  public getDragClassCancel(): string {
    return 'grid-drag-cancel';
  }

  public getDragHooks = () => {
    return { onDragStart: this.onPointerDown };
  };

  public onPointerDown = (e: PointerEvent, panel: VizPanel) => {
    const cannotDrag = this.cannotDrag(e.target);
    if (cannotDrag || !this.layoutOrchestrator) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // Refresh bounding boxes for all responsive grid items
    for (const child of this.state.children) {
      child.computeBoundingBox();
    }

    this.scrollPos = closestScroll(this.containerRef.current);
    this.layoutOrchestrator.onDragStart(e.nativeEvent, panel);
  };

  private cannotDrag(el: EventTarget): boolean | Element {
    const dragClass = this.getDragClass();
    const dragCancelClass = this.getDragClassCancel();

    // cancel dragging if the element being interacted with has an ancestor with the drag cancel class set
    // or if the drag class isn't set on an ancestor
    return el instanceof Element && (el.closest(`.${dragCancelClass}`) || !el.closest(`.${dragClass}`));
  }

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
        const { top, bottom, left, right } = gridItem.cachedBoundingBox;
        closestRect = { top, bottom, left, right };
        closestIndex = i;
        // css grid rows/columns are 1-indexed
        closest = { row: curRow + 1, column: curColumn + 1 };
      }
    });

    this.activeIndex = closestIndex;
    this.activeGridCell = closest;

    return { ...closestRect, distanceToPoint: minDistance };
  }

  public importLayoutItem(layoutItem: DashboardLayoutItem) {
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

  public removeLayoutItem(layoutItem: DashboardLayoutItem) {
    this.setState({
      children: this.state.children.filter((c) => c !== layoutItem),
    });

    layoutItem.clearParent();
  }
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

function canScroll(el: HTMLElement) {
  const oldScroll = el.scrollTop;
  el.scrollTop = Number.MAX_SAFE_INTEGER;
  const newScroll = el.scrollTop;
  el.scrollTop = oldScroll;

  return newScroll > 0;
}
