/**
 * jest-canvas-mock's `Path2D` ignores its constructor argument, so `new Path2D(otherPath)` drops the
 * copied geometry. uPlot builds series area fills that way (`new Path2D(strokePath)`, then extends them to
 * the baseline), so without this fix area fills, gradient bands, and markers never appear in canvas
 * snapshots. This installs a `Path2D` that honors the copy constructor; call once before rendering.
 *
 * SVG path-string construction (`new Path2D('M0 0 L1 1')`) is not supported — uPlot doesn't use it, and the
 * unpatched mock already ignored it.
 *
 * This reassigns the global `Path2D`, so call it from a suite's setup or a test module's top scope — never
 * from a global jest setupFile. jest gives each test file its own environment, so the swap stays scoped to
 * the file that calls it; wiring it globally would patch `Path2D` for every test.
 */
let installed = false;

export function installCanvasPath2DShim(): void {
  const Base = globalThis.Path2D;
  if (installed || typeof Base !== 'function') {
    return;
  }
  installed = true;

  globalThis.Path2D = class extends Base {
    constructor(path?: Path2D | string) {
      super();
      // jest-canvas-mock records path ops on a private `_path` array; copy the source's when cloning.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const src = path as any;
      if (path instanceof Base) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any)._path.push(...src._path);
      }
    }
  };
}
