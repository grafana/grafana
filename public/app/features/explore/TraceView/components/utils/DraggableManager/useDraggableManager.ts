import { useEffect, useRef } from 'react';
import type * as React from 'react';

import DraggableManager, { type DraggableManagerOptions } from './DraggableManager';
import { type DraggingUpdate } from './types';

type Callback = keyof Omit<DraggableManagerOptions, 'getBounds' | 'resetBoundsOnResize' | 'tag'>;

const CALLBACKS: Callback[] = ['onMouseEnter', 'onMouseLeave', 'onMouseMove', 'onDragStart', 'onDragMove', 'onDragEnd'];

/**
 * Owns a `DraggableManager` for the lifetime of the component and returns mouse handlers to put on the
 * element. Callbacks always see the latest `options`.
 * `tag`, `resetBoundsOnResize` and which callbacks are provided are read once, on mount.
 */
export function useDraggableManager(options: DraggableManagerOptions) {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const managerRef = useRef<DraggableManager>(undefined);
  useEffect(() => {
    const { tag, resetBoundsOnResize, ...initial } = optionsRef.current;
    const callbacks: Partial<Pick<DraggableManagerOptions, Callback>> = {};
    for (const name of CALLBACKS) {
      // Only wire up callbacks that exist, because the manager skips computing bounds for missing ones.
      if (initial[name]) {
        callbacks[name] = (update: DraggingUpdate) => optionsRef.current[name]?.(update);
      }
    }
    const manager = new DraggableManager({
      tag,
      resetBoundsOnResize,
      getBounds: (boundsTag) => optionsRef.current.getBounds(boundsTag),
      ...callbacks,
    });
    managerRef.current = manager;
    return () => {
      manager.dispose();
      managerRef.current = undefined;
    };
  }, []);

  return {
    onMouseDown: (event: React.MouseEvent) => managerRef.current?.handleMouseDown(event),
    onMouseEnter: (event: React.MouseEvent) => managerRef.current?.handleMouseEnter(event),
    onMouseMove: (event: React.MouseEvent) => managerRef.current?.handleMouseMove(event),
    onMouseLeave: (event: React.MouseEvent) => managerRef.current?.handleMouseLeave(event),
  };
}
