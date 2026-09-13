/**
 * @jest-environment jsdom
 */
import 'jest-canvas-mock';

import { installCanvasPath2DShim } from './path2d';

describe('installCanvasPath2DShim', () => {
  installCanvasPath2DShim();

  it('preserves geometry through the copy constructor', () => {
    const stroke = new Path2D();
    stroke.moveTo(0, 0);
    stroke.lineTo(10, 10);
    stroke.lineTo(20, 5);

    const copy = new Path2D(stroke);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((copy as any)._path).toHaveLength((stroke as any)._path.length);
  });

  it('makes ctx.fill capture the copied path (uPlot area-fill pattern)', () => {
    const ctx = document.createElement('canvas').getContext('2d')!;

    // Mirror uPlot: build a stroke path, copy it into the fill, extend to a baseline, then fill.
    const stroke = new Path2D();
    stroke.moveTo(0, 0);
    stroke.lineTo(10, 10);
    stroke.lineTo(20, 5);

    const fill = new Path2D(stroke);
    fill.lineTo(20, 100);
    fill.lineTo(0, 100);
    ctx.fill(fill);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fillEvent = (ctx as any).__getEvents().find((e: { type: string }) => e.type === 'fill');
    // 3 from the copied stroke + 2 baseline = 5. Without the shim this would be only the 2 baseline points.
    expect(fillEvent.props.path).toHaveLength(5);
  });

  it('is idempotent', () => {
    const first = globalThis.Path2D;
    installCanvasPath2DShim();
    expect(globalThis.Path2D).toBe(first);
  });
});
