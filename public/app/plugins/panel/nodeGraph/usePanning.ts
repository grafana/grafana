import { useEffect, useRef, RefObject, useState, useMemo } from 'react';
import useMountedState from 'react-use/lib/useMountedState';
import usePrevious from 'react-use/lib/usePrevious';

import { Bounds } from './utils';

export interface State {
  isPanning: boolean;
  position: {
    x: number;
    y: number;
  };
}

interface Options {
  scale?: number;
  bounds?: Bounds;
  focus?: {
    x: number;
    y: number;
  };
}

/**
 * Based on https://github.com/streamich/react-use/blob/master/src/useSlider.ts
 * Returns position x/y coordinates which can be directly used in transform: translate().
 * @param scale - Can be used when we want to scale the movement if we are moving a scaled element. We need to do it
 *   here because we don't want to change the pos when scale changes.
 * @param bounds - If set the panning cannot go outside of those bounds.
 * @param focus - Position to focus on.
 */
export function usePanning<T extends Element>({ scale = 1, bounds, focus }: Options = {}): {
  state: State;
  ref: RefObject<T>;
} {
  const isMounted = useMountedState();
  const isPanning = useRef(false);
  const frame = useRef(0);
  const panRef = useRef<T>(null);

  const initial = { x: 0, y: 0 };
  // As we return a diff of the view port to be applied we need as translate coordinates we have to invert the
  // bounds of the content to get the bounds of the view port diff.
  const viewBounds = useMemo(
    () => ({
      right: bounds ? -bounds.left : Infinity,
      left: bounds ? -bounds.right : -Infinity,
      bottom: bounds ? -bounds.top : -Infinity,
      top: bounds ? -bounds.bottom : Infinity,
    }),
    [bounds]
  );

  // We need to keep some state so we can compute the position diff and add that to the previous position.
  const startMousePosition = useRef(initial);
  const prevPosition = useRef(initial);
  // We cannot use the state as that would rerun the effect on each state change which we don't want so we have to keep
  // separate variable for the state that won't cause useEffect eval
  const currentPosition = useRef(initial);

  const [state, setState] = useState<State>({
    isPanning: false,
    position: initial,
  });

  useEffect(() => {
    const startPanning = (event: Event) => {
      if (!isPanning.current && isMounted()) {
        isPanning.current = true;
        // Snapshot the current position of both mouse pointer and the element
        startMousePosition.current = getEventXY(event);
        prevPosition.current = { ...currentPosition.current };
        setState((state) => ({ ...state, isPanning: true }));
        bindEvents();
      }
    };

    const stopPanning = () => {
      if (isPanning.current && isMounted()) {
        isPanning.current = false;
        setState((state) => ({ ...state, isPanning: false }));
        unbindEvents();
      }
    };

    const onPanStart = (event: Event) => {
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

    const onPan = (event: Event) => {
      cancelAnimationFrame(frame.current);
      const pos = getEventXY(event);

      frame.current = requestAnimationFrame(() => {
        if (isMounted() && panRef.current) {
          // Get the diff by which we moved the mouse.
          let xDiff = pos.x - startMousePosition.current.x;
          let yDiff = pos.y - startMousePosition.current.y;

          // Add the diff to the position from the moment we started panning.
          currentPosition.current = {
            x: inBounds(prevPosition.current.x + xDiff / scale, viewBounds.left, viewBounds.right),
            y: inBounds(prevPosition.current.y + yDiff / scale, viewBounds.top, viewBounds.bottom),
          };
          setState((state) => ({
            ...state,
            position: {
              ...currentPosition.current,
            },
          }));
        }
      });
    };

    const ref = panRef.current;
    if (ref) {
      ref.addEventListener('mousedown', onPanStart);
      ref.addEventListener('touchstart', onPanStart);
    }
    return () => {
      if (ref) {
        ref.removeEventListener('mousedown', onPanStart);
        ref.removeEventListener('touchstart', onPanStart);
      }
    };
  }, [scale, viewBounds, isMounted]);

  const previousFocus = usePrevious(focus);

  // We need to update the state in case need to focus on something but we want to do it only once when the focus
  // changes to something new.
  useEffect(() => {
    if (focus && previousFocus?.x !== focus.x && previousFocus?.y !== focus.y) {
      const position = {
        x: inBounds(focus.x, viewBounds.left, viewBounds.right),
        y: inBounds(focus.y, viewBounds.top, viewBounds.bottom),
      };
      setState({
        position,
        isPanning: false,
      });

      currentPosition.current = position;
      prevPosition.current = position;
    }
  }, [focus, previousFocus, viewBounds, currentPosition, prevPosition]);

  let position = state.position;
  // This part prevents an ugly jump from initial position to the focused one as the set state in the effects is after
  // initial render.
  if (focus && previousFocus?.x !== focus.x && previousFocus?.y !== focus.y) {
    position = focus;
  }

  return {
    state: {
      ...state,
      position: {
        x: inBounds(position.x, viewBounds.left, viewBounds.right),
        y: inBounds(position.y, viewBounds.top, viewBounds.bottom),
      },
    },
    ref: panRef,
  };
}

function inBounds(value: number, min: number | undefined, max: number | undefined) {
  return Math.min(Math.max(value, min ?? -Infinity), max ?? Infinity);
}

function getEventXY(event: Event): { x: number; y: number } {
  if (event instanceof TouchEvent) {
    return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
  } else if (event instanceof MouseEvent) {
    return { x: event.clientX, y: event.clientY };
  } else {
    return { x: 0, y: 0 };
  }
}
