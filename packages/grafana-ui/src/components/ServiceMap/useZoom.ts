import { useCallback, useEffect, useRef, useState } from 'react';

interface Options {
  stepUp: (scale: number) => number;
  stepDown: (scale: number) => number;
  min?: number;
  max?: number;
}
export function useZoom({ stepUp, stepDown, min, max }: Options) {
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
      if (wheelEvent.ctrlKey || wheelEvent.metaKey) {
        event.preventDefault();

        if (wheelEvent.deltaY > 0) {
          onStepUp();
        } else if (wheelEvent.deltaY < 0) {
          onStepDown();
        }
      }
    },
    [onStepDown, onStepUp]
  );

  useEffect(() => {
    if (ref.current) {
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
    ref,
  };
}
