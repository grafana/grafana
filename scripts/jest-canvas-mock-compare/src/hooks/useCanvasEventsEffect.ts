import type { CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import { type RefObject, useEffect } from 'react';

import { eventsToCanvasScript } from '../canvasUtils.ts';
import type { CanvasEventArray } from '../types.ts';

export function useCanvasEventsEffect(
  ref: RefObject<HTMLCanvasElement | null>,
  events: CanvasEventArray,
  setupEvents: CanvasRenderingContext2DEvent[],
  includeSetup: boolean
) {
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }

    // identity transform and clearRect need to be called or toggling the uPlot canvas events doesn't work
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (includeSetup) {
      eventsToCanvasScript(setupEvents, context);
    }
    eventsToCanvasScript(events, context);
  }, [events, includeSetup, ref, setupEvents]);
}
