import type { CanvasRenderingContext2DEvent } from 'jest-canvas-mock';

// @todo export from package
export function scrubOutput(
  events: CanvasRenderingContext2DEvent[]
): Array<Omit<CanvasRenderingContext2DEvent, 'transform'>> {
  return events.map(({ transform, ...event }) =>
    event.props.path ? { ...event, props: { ...event.props, path: scrubOutput(event.props.path) } } : event
  );
}
