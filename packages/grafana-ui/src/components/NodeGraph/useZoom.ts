import { useCallback, useEffect, useRef, useState } from 'react';

const defaultOptions: Options = {
  stepDown: s => s / 1.5,
  stepUp: s => s * 1.5,
  min: 0.13,
  max: 2.25,
};

interface Options {
  /**
   * Allows you to specify how the step up will be handled so you can do fractional steps based on previous value.
   */
  stepUp: (scale: number) => number;
  stepDown: (scale: number) => number;

  /**
   * Set max and min values. If stepUp/down overshoots these bounds this will return min or max but internal scale value
   * will still be what ever the step functions returned last.
   */
  min?: number;
  max?: number;
}

/**
 * Keeps state and returns handlers that can be used to implement zooming functionality ideally by using it with
 * 'transform: scale'. It returns handler for manual buttons with zoom in/zoom out function and a ref that can be
 * used to zoom in/out with mouse wheel.
 */
export function useZoom({ stepUp, stepDown, min, max } = defaultOptions) {
  const ref = useRef<HTMLElement>(null);
  const [scale, setScale] = useState(1);

  const onStepUp = useCallback(() => {
    if (scale < (max ?? Infinity)) {
      setScale(stepUp(scale));
    }
  }, [scale, stepUp, max]);

  const onStepDown = useCallback(() => {
    if (scale > (min ?? -Infinity)) {
      setScale(stepDown(scale));
    }
  }, [scale, stepDown, min]);

  const onWheel = useCallback(
    function(event: Event) {
      // Seems like typing for the addEventListener is lacking a bit
      const wheelEvent = event as WheelEvent;

      // Only do this with special key pressed similar to how google maps work.
      // TODO: I would guess this won't work very well with touch right now
      if (wheelEvent.ctrlKey || wheelEvent.metaKey) {
        event.preventDefault();

        if (wheelEvent.deltaY < 0) {
          onStepUp();
        } else if (wheelEvent.deltaY > 0) {
          onStepDown();
        }
      }
    },
    [onStepDown, onStepUp]
  );

  useEffect(() => {
    if (ref.current) {
      // Adds listener for wheel event, we need the passive: false to be able to prevent default otherwise that
      // cannot be used with passive listeners.
      ref.current.addEventListener('wheel', onWheel, { passive: false });
      return () => {
        if (ref.current) {
          ref.current.removeEventListener('wheel', onWheel);
        }
      };
    }
    return undefined;
  }, [ref.current, onWheel]);

  return {
    onStepUp,
    onStepDown,
    scale: Math.max(Math.min(scale, max ?? Infinity), min ?? -Infinity),
    isMax: scale >= (max ?? Infinity),
    isMin: scale <= (min ?? -Infinity),
    ref,
  };
}
