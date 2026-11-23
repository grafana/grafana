// react-grid-layout 1.x ships Flow types only. These cover just the build modules the custom grid imports.

declare module 'react-grid-layout/build/utils' {
  export interface LayoutItem {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    moved?: boolean;
    static?: boolean;
  }

  export type Layout = LayoutItem[];
  export type CompactType = 'vertical' | 'horizontal' | null;
  export type ResizeHandleAxis = 's' | 'w' | 'e' | 'n' | 'sw' | 'nw' | 'se' | 'ne';

  export interface Position {
    left: number;
    top: number;
    width: number;
    height: number;
  }

  export function bottom(layout: readonly LayoutItem[]): number;
  export function collides(l1: LayoutItem, l2: LayoutItem): boolean;
  /** Returns new items in the input order, but also moves items of the input layout while resolving collisions. */
  export function compact(layout: Layout, compactType: CompactType, cols: number, allowOverlap?: boolean): Layout;
  /** Mutates the items of the layout. */
  export function correctBounds(layout: Layout, bounds: { cols: number }): Layout;
  export function getLayoutItem(layout: Layout, id: string): LayoutItem | undefined;
  /** Mutates the moved item and the items it pushes away. */
  export function moveElement(
    layout: Layout,
    l: LayoutItem,
    x: number | undefined,
    y: number | undefined,
    isUserAction: boolean,
    preventCollision: boolean,
    compactType: CompactType,
    cols: number,
    allowOverlap?: boolean
  ): Layout;
  export function resizeItemInDirection(
    direction: ResizeHandleAxis,
    currentSize: Position,
    newSize: Partial<Position>,
    containerWidth: number
  ): Position;
}

declare module 'react-grid-layout/build/calculateUtils' {
  import type { Position, ResizeHandleAxis } from 'react-grid-layout/build/utils';

  export interface PositionParams {
    margin: [number, number];
    containerPadding: [number, number];
    containerWidth: number;
    cols: number;
    rowHeight: number;
    maxRows: number;
  }

  export function calcGridItemPosition(
    positionParams: PositionParams,
    x: number,
    y: number,
    w: number,
    h: number,
    state?: { resizing?: Position | null; dragging?: Pick<Position, 'top' | 'left'> | null }
  ): Position;
  export function calcXY(
    positionParams: PositionParams,
    top: number,
    left: number,
    w: number,
    h: number
  ): { x: number; y: number };
  export function calcWH(
    positionParams: PositionParams,
    width: number,
    height: number,
    x: number,
    y: number,
    handle: ResizeHandleAxis
  ): { w: number; h: number };
  export function clamp(num: number, lowerBound: number, upperBound: number): number;
}
