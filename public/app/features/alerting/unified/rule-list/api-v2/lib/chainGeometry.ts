export interface ArrowEndpoint {
  x: number;
  y: number;
}

export interface ArrowPath {
  key: string;
  d: string;
  from: ArrowEndpoint;
  to: ArrowEndpoint;
}

export function buildArrowPath(from: ArrowEndpoint, to: ArrowEndpoint): string {
  const dx = to.x - from.x;
  const cp1x = from.x + dx * 0.5;
  const cp2x = to.x - dx * 0.5;
  return `M ${from.x},${from.y} C ${cp1x},${from.y} ${cp2x},${to.y} ${to.x},${to.y}`;
}

export function centerOf(rect: DOMRect, containerRect: DOMRect, side: 'left' | 'right'): ArrowEndpoint {
  const y = rect.top + rect.height / 2 - containerRect.top;
  const x = side === 'left' ? rect.left - containerRect.left : rect.right - containerRect.left;
  return { x, y };
}
