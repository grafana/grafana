import { useEffect, useRef, RefObject, useState } from 'react';

import useMountedState from 'react-use/lib/useMountedState';

export interface State {
  isPanning: boolean;
  position: {
    x: number;
    y: number;
  };
}

/**
 * Based on https://github.com/streamich/react-use/blob/master/src/useSlider.ts
 * Returns position x/y coordinates which can be directly used in transform: translate().
 */
export function usePanning(ref: RefObject<Element>): State {
  const isMounted = useMountedState();
  const isPanning = useRef(false);
  const frame = useRef(0);

  // We need to keep some state so we can compute the position diff and add that to the previous position.
  const startMousePosition = useRef({ x: 0, y: 0 });
  const prevPosition = useRef({ x: 0, y: 0 });
  // We cannot use the state as that would rerun the effect on each state change which we don't want so we have to keep
  // separate variable for the state that won't cause useEffect eval
  const currentPosition = useRef({ x: 0, y: 0 });

  const [state, setState] = useState<State>({
    isPanning: false,
    position: { x: 0, y: 0 },
  });

  useEffect(() => {
    const startPanning = (event: MouseEvent | TouchEvent) => {
      if (!isPanning.current && isMounted()) {
        isPanning.current = true;
        // Snapshot the current position of both mouse pointer and the element
        startMousePosition.current = getEventXY(event);
        prevPosition.current = { ...currentPosition.current };
        setState(state => ({ ...state, isPanning: true }));
        bindEvents();
      }
    };

    const stopPanning = () => {
      if (isPanning.current && isMounted()) {
        isPanning.current = false;
        setState(state => ({ ...state, isPanning: false }));
        unbindEvents();
      }
    };

    const onPanStart = (event: MouseEvent | TouchEvent) => {
      startPanning(event);
      onPan(event);
    };

    const bindEvents = () => {
      document.addEventListener('mousemove', onPan);
      document.addEventListener('mouseup', stopPanning);
      document.addEventListener('touchmove', onPan);
      document.addEventListener('touchend', stopPanning);
    };

    const unbindEvents = () => {
      document.removeEventListener('mousemove', onPan);
      document.removeEventListener('mouseup', stopPanning);
      document.removeEventListener('touchmove', onPan);
      document.removeEventListener('touchend', stopPanning);
    };

    const onPan = (event: MouseEvent | TouchEvent) => {
      cancelAnimationFrame(frame.current);
      const pos = getEventXY(event);

      frame.current = requestAnimationFrame(() => {
        if (isMounted() && ref.current) {
          // Get the diff by which we moved the mouse.
          let xDiff = pos.x - startMousePosition.current.x;
          let yDiff = pos.y - startMousePosition.current.y;

          // Add the diff to the position from the moment we started panning.
          currentPosition.current = {
            x: prevPosition.current.x + xDiff,
            y: prevPosition.current.y + yDiff,
          };
          setState(state => ({
            ...state,
            position: {
              ...currentPosition.current,
            },
          }));
        }
      });
    };

    if (ref.current) {
      ref.current.addEventListener('mousedown', onPanStart);
      ref.current.addEventListener('touchstart', onPanStart);
    }
    return () => {
      if (ref.current) {
        ref.current.removeEventListener('mousedown', onPanStart);
        ref.current.removeEventListener('touchstart', onPanStart);
      }
    };
  }, [ref]);

  return state;
}

function getEventXY(event: MouseEvent | TouchEvent): { x: number; y: number } {
  if ((event as any).changedTouches) {
    const e = event as TouchEvent;
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  } else {
    const e = event as MouseEvent;
    return { x: e.clientX, y: e.clientY };
  }
}
