// react-grid-layout (1.4.4) ships no types and is a transitive dependency of @grafana/scenes;
// this declares the subset of its API consumed by the homepage widget grid so the direct import typechecks.
declare module 'react-grid-layout' {
  import type * as React from 'react';

  export interface Layout {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    maxW?: number;
    minH?: number;
    maxH?: number;
    static?: boolean;
    isDraggable?: boolean;
    isResizable?: boolean;
    isBounded?: boolean;
    resizeHandles?: Array<'s' | 'w' | 'e' | 'n' | 'sw' | 'nw' | 'se' | 'ne'>;
  }

  export type ItemCallback = (
    layout: Layout[],
    oldItem: Layout,
    newItem: Layout,
    placeholder: Layout,
    event: MouseEvent,
    element: HTMLElement
  ) => void;

  export interface ReactGridLayoutProps {
    className?: string;
    style?: React.CSSProperties;
    width?: number;
    autoSize?: boolean;
    cols?: number;
    rowHeight?: number;
    maxRows?: number;
    margin?: [number, number];
    containerPadding?: [number, number] | null;
    draggableCancel?: string;
    draggableHandle?: string;
    isBounded?: boolean;
    isDraggable?: boolean;
    isResizable?: boolean;
    isDroppable?: boolean;
    useCSSTransforms?: boolean;
    preventCollision?: boolean;
    allowOverlap?: boolean;
    compactType?: 'vertical' | 'horizontal' | null;
    layout?: Layout[];
    onLayoutChange?: (layout: Layout[]) => void;
    onDragStart?: ItemCallback;
    onDrag?: ItemCallback;
    onDragStop?: ItemCallback;
    onResizeStart?: ItemCallback;
    onResize?: ItemCallback;
    onResizeStop?: ItemCallback;
    children?: React.ReactNode;
  }

  const ReactGridLayout: React.ComponentClass<ReactGridLayoutProps>;
  export default ReactGridLayout;

  export interface WidthProviderProps {
    measureBeforeMount?: boolean;
  }

  export function WidthProvider<P extends object>(
    component: React.ComponentType<P>
  ): React.ComponentType<Omit<P, 'width'> & WidthProviderProps>;
}

declare module 'react-grid-layout/css/styles.css';
declare module 'react-resizable/css/styles.css';
