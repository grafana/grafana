/**
 * jest-canvas-mock's `Path2D` ignores its constructor argument. Real browsers (and uPlot) rely on the
 * copy constructor `new Path2D(otherPath)` — uPlot builds series area fills as `new Path2D(strokePath)`,
 * then extends them to the baseline. Under the unpatched mock the copied geometry is dropped, so
 * `ctx.fill(path)` records a degenerate path and the fill never appears in the snapshot.
 *
 * This installs a `Path2D` subclass that honors the copy constructor, so copied paths are captured by
 * `ctx.fill` / `ctx.stroke` / `ctx.clip`. Call once before rendering (module scope or `beforeAll`).
 *
 * No-op if already installed, or if `Path2D` is unavailable (e.g. non-canvas-mock environments).
 * SVG path-string construction (`new Path2D('M0 0 L1 1')`) is intentionally not supported — uPlot does
 * not use it, and the unpatched mock already ignored it, so this is not a regression.
 */

const SHIM_FLAG = '__grafanaCanvasPath2DShim';

// jest-canvas-mock's Path2D stores its recorded ops on a `_path` array.
interface MockPath2D {
  _path?: unknown[];
}

export function installCanvasPath2DShim(): void {
  const Base: typeof Path2D | undefined = globalThis.Path2D;

  if (!Base || (Base as unknown as Record<string, unknown>)[SHIM_FLAG]) {
    return;
  }

  const BaseCtor: typeof Path2D = Base;

  class Path2DWithCopyConstructor extends BaseCtor {
    constructor(path?: Path2D | string) {
      super();

      if (path instanceof BaseCtor) {
        const src = path as unknown as MockPath2D;
        const dest = this as unknown as MockPath2D;
        if (Array.isArray(src._path) && Array.isArray(dest._path)) {
          dest._path.push(...src._path);
        }
      }
    }
  }

  Object.defineProperty(Path2DWithCopyConstructor, SHIM_FLAG, { value: true });
  globalThis.Path2D = Path2DWithCopyConstructor;
}
