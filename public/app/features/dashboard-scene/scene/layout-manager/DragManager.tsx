import { createRef } from 'react';
import { createRoot, Root } from 'react-dom/client';

import { sceneGraph, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { getPortalContainer } from '@grafana/ui';

import { ResponsiveGridItem } from '../layout-responsive-grid/ResponsiveGridItem';
import { Rect, SceneCSSGridLayout } from '../layout-responsive-grid/SceneCSSGridLayout';

export type DropZone = Rect & { layoutKey: string };

interface DragManagerState extends SceneObjectState {
  activeLayout?: SceneCSSGridLayout;
  activeItem?: SceneObject;
  dropZone?: DropZone;
}

export class DragManager extends SceneObjectBase<DragManagerState> {
  private layouts: Record<string, SceneCSSGridLayout> = {};
  public dropZones: DropZone[] = [];

  private portalRoot!: Root;
  private portal = createRef<HTMLDivElement>();
  private preview = createRef<HTMLDivElement>();
  private originLayout: SceneCSSGridLayout | undefined;

  public registerLayout(layout: SceneCSSGridLayout) {
    this.layouts[layout.state.key!] = layout;
  }

  public onDragStart = (e: PointerEvent, layout: SceneCSSGridLayout, item: SceneObject) => {
    // find closest layout item
    const layoutItem = sceneGraph.getAncestor(item, ResponsiveGridItem);
    this.originLayout = layout;
    const root = getPortalContainer().appendChild(document.createElement('div'));
    this.portalRoot = createRoot(root);

    document.addEventListener('pointermove', this.onDrag);
    document.addEventListener('pointerup', this.onDragEnd);
    document.body.classList.add('dragging-active');

    // request drop zones from registered layouts
    const dropZones = [];
    for (const l of Object.values(this.layouts)) {
      dropZones.push(...l.getDropZones().map((v) => ({ ...v, layoutKey: l.state.key! })));
    }
    this.dropZones = dropZones;
    const { closest, offset, scrollTop } = this.closestCell(this.dropZones, { x: e.clientX, y: e.clientY });

    this.portalRoot.render(
      <>
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            translate: `${offset.x}px ${offset.y}px`,
            transform: `translate(${e.clientX}px,${e.clientY}px)`,
            width: `${closest.right - closest.left}px`,
            height: `${closest.bottom - closest.top}px`,
            zIndex: '999999',
          }}
          ref={this.portal}
        >
          <item.Component model={item} />
        </div>
        <div
          className="react-grid-item react-grid-placeholder"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: `${closest.right - closest.left}px`,
            height: `${closest.bottom - closest.top}px`,
            pointerEvents: 'none',
            zIndex: '1000',
            translate: `${closest.left}px ${closest.top - scrollTop}px`,
            transition: 'transform 150ms ease',
          }}
          ref={this.preview}
        ></div>
      </>
    );

    // measure and store height of all scroll zones
    this.setState({
      activeItem: layoutItem,
      dropZone: closest,
    });
  };

  public refreshDropZones() {
    const dropZones = [];
    for (const l of Object.values(this.layouts)) {
      dropZones.push(...l.getDropZones().map((v) => ({ ...v, layoutKey: l.state.key! })));
    }

    this.dropZones = dropZones;
  }

  public onDrag = (e: PointerEvent) => {
    const localDropZones = this.dropZones.filter((v) => v.layoutKey === this.state.activeLayout!.state.key);
    let cell = this.closestCell(localDropZones, { x: e.clientX, y: e.clientY });
    let state: Partial<DragManagerState> = {};

    if (
      !this.state.dropZone ||
      this.state.dropZone.layoutKey !== cell.closest.layoutKey ||
      this.state.dropZone.order !== cell.closest.order
    ) {
      // new layout item entered
      state.dropZone = cell.closest;
      if (this.preview.current) {
        this.preview.current.style.width = `${state.dropZone.right - state.dropZone.left}px`;
        this.preview.current.style.height = `${state.dropZone.bottom - state.dropZone.top}px`;
        this.preview.current.style.translate = `${state.dropZone.left}px ${state.dropZone.top - cell.scrollTop}px`;
        this.preview.current.style.transition = 'translate 150ms ease, width 150ms ease, height 150ms ease';
      }
    }

    if (Object.keys(state).length > 0) {
      this.setState(state);
    }

    // set transform on layout item we're dragging.
    if (this.portal.current) {
      this.portal.current.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
    }
  };

  public onDragEnd = (e: PointerEvent) => {
    document.removeEventListener('pointermove', this.onDrag);
    document.removeEventListener('pointerup', this.onDragEnd);

    document.body.releasePointerCapture(e.pointerId);
    if (this.originLayout === this.state.activeLayout && this.originLayout) {
      const kids = [...this.state.activeLayout!.state.children];
      const oldIndex = kids.indexOf(this.state.activeItem!);
      const childToMove = kids.splice(oldIndex, 1)[0];
      kids.splice(this.state.dropZone!.order, 0, childToMove);
      this.originLayout?.setState({
        children: kids,
      });
    } else if (this.originLayout !== this.state.activeLayout && this.state.activeLayout) {
      this.originLayout?.setState({
        children: this.originLayout.state.children.filter((v) => v !== this.state.activeItem),
      });
      const kids = [...this.state.activeLayout!.state.children];
      kids.splice(this.state.dropZone!.order, 0, this.state.activeItem!);
      this.state.activeLayout.setState({
        children: kids,
      });
    }

    this.setState({ activeItem: undefined, dropZone: undefined });
    this.portalRoot.unmount();
    document.body.classList.remove('dragging-active');
  };

  /** Given an array of rectangles and a point, calculate the rectangle closest to the point */
  private closestCell(rects: DropZone[], point: Point) {
    const scrollTopMap: Record<string, number> = {};
    for (const rect of rects) {
      const layout = sceneGraph.findByKeyAndType(this, rect.layoutKey, SceneCSSGridLayout);
      scrollTopMap[rect.layoutKey] = closestScroll(layout.getContainer());
    }

    let closest = rects[0];
    let shortestDistance = Number.MAX_SAFE_INTEGER;
    let offset: Point = { x: 0, y: 0 };
    let scrollTop = 0;
    let from = 'top';
    for (const rect of rects) {
      const topLeft = { x: rect.left, y: rect.top };
      const topRight = { x: rect.right, y: rect.top };
      const bottomLeft = { x: rect.left, y: rect.bottom };
      const bottomRight = { x: rect.right, y: rect.bottom };
      const lines: Array<{ points: [Point, Point]; id: string }> = [
        { points: [topLeft, topRight], id: 'top' },
        { points: [topLeft, bottomLeft], id: 'left' },
        { points: [bottomLeft, bottomRight], id: 'bottom' },
        { points: [topRight, bottomRight], id: 'right' },
      ];

      for (const line of lines) {
        const distance = shortestDistanceToLine({ x: point.x, y: point.y + scrollTopMap[rect.layoutKey] }, line.points);
        if (distance < shortestDistance) {
          shortestDistance = distance;
          closest = rect;
          scrollTop = scrollTopMap[rect.layoutKey];
          from = line.id;
          offset = { x: topLeft.x - point.x, y: topLeft.y - point.y - scrollTopMap[rect.layoutKey] };
        }
      }
    }

    return { closest, offset, scrollTop, from };
  }
}

function closestScroll(el?: HTMLElement | null): number {
  if (el && el.scrollTop > 0) {
    return el.scrollTop;
  }

  return el ? closestScroll(el.parentElement) : 0;
}

interface Point {
  x: number;
  y: number;
}

function shortestDistanceToLine(point: Point, line: [Point, Point]) {
  const [{ x: x1, y: y1 }, { x: x2, y: y2 }] = line;
  const { x, y } = point;
  const dx = x2 - x1;
  const dy = y2 - y1;

  const dot = (x - x1) * dx + (y - y1) * dy;
  const lengthSquared = dx * dx + dy * dy;
  const param = dot / lengthSquared;

  let xx = x1 + param * dx;
  let yy = y1 + param * dy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  }

  const xDistance = x - xx;
  const yDistance = y - yy;
  return Math.hypot(xDistance, yDistance);
}
