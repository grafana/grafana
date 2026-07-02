import { type ReactNode } from 'react';

// react-data-grid sizes itself to its container (block-size: 100%) rather than to the width/height
// props, so the grid needs a parent with definite dimensions. Without one it collapses inside any
// parent that lacks a definite height — e.g. a react-virtualized AutoSizer render-prop child — and
// virtualizes down to a couple of rows. Establishing the box from the props here means the table
// honors its own width/height and consumers don't each have to wrap it.
export function TableSizeContainer({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: ReactNode;
}) {
  return <div style={{ width, height }}>{children}</div>;
}
