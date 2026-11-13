import { useLayoutEffect, useRef, useState } from 'react';
import type * as React from 'react';

import DraggableManager, { type DraggableManagerOptions } from './DraggableManager';

/**
 * Owns a `DraggableManager` for the lifetime of the component and returns stable mouse handlers to put on the
 * element. During a drag the callbacks are called from `window` listeners, outside React's event handling, so the
 * options are synced in a layout effect to guarantee those callbacks never see a previous render's props.
 */
export function useDraggableManager(options: DraggableManagerOptions) {
  const managerRef = useRef<DraggableManager>(undefined);

  useLayoutEffect(() => {
    if (managerRef.current) {
      managerRef.current.setOptions(options);
    } else {
      managerRef.current = new DraggableManager(options);
    }
  });

  useLayoutEffect(
    () => () => {
      managerRef.current?.dispose();
      managerRef.current = undefined;
    },
    []
  );

  const [handlers] = useState(() => ({
    onMouseDown: (event: React.MouseEvent) => managerRef.current?.handleMouseDown(event),
    onMouseEnter: (event: React.MouseEvent) => managerRef.current?.handleMouseEnter(event),
    onMouseMove: (event: React.MouseEvent) => managerRef.current?.handleMouseMove(event),
    onMouseLeave: (event: React.MouseEvent) => managerRef.current?.handleMouseLeave(event),
  }));
  return handlers;
}
