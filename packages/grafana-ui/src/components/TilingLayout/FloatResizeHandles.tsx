import { memo } from 'react';
import type * as React from 'react';

import { type ResizeDirection, useTilingInternals } from './internalContext';
import { type Rect } from './model/types';

const RESIZE_DIRECTIONS: ResizeDirection[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const HANDLE = 6;

function handleStyle(dir: ResizeDirection): React.CSSProperties {
  const corner = dir.length === 2;
  const size = corner ? HANDLE * 2 : HANDLE;
  const style: React.CSSProperties = { cursor: `${dir}-resize` };
  if (dir.includes('n')) {
    style.top = 0;
  }
  if (dir.includes('s')) {
    style.bottom = 0;
  }
  if (dir.includes('e')) {
    style.right = 0;
  }
  if (dir.includes('w')) {
    style.left = 0;
  }
  if (dir === 'n' || dir === 's') {
    Object.assign(style, { left: HANDLE, right: HANDLE, height: HANDLE });
  } else if (dir === 'e' || dir === 'w') {
    Object.assign(style, { top: HANDLE, bottom: HANDLE, width: HANDLE });
  } else {
    Object.assign(style, { width: size, height: size, zIndex: 2 });
  }
  return style;
}

/** Edge and corner handles of a floating panel, layered above its content. */
export const FloatResizeHandles = memo(function FloatResizeHandles({
  panelId,
  rect,
  z,
}: {
  panelId: string;
  rect: Rect;
  z: number;
}) {
  const { styles, onFloatResizeStart } = useTilingInternals();
  return (
    <div className={styles.resizeLayer} style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex: z }}>
      {RESIZE_DIRECTIONS.map((dir) => (
        <div
          key={dir}
          className={styles.resizeHandle}
          style={handleStyle(dir)}
          data-dir={dir}
          onPointerDown={(e) => onFloatResizeStart(e, panelId, dir)}
        />
      ))}
    </div>
  );
});
