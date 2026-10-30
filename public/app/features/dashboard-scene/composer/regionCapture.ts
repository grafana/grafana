/**
 * Region capture: render a document root with html-to-image, crop the region out of the raster and encode
 * it small enough for the model. The caller decides what the root is and what to leave out of it. The crop uses the raster's real scale (raster pixels per CSS pixel), which is
 * not always the device pixel ratio: html-to-image may round, and a large dashboard renders below it.
 */

import { type Box } from './composerGeometry';
import { cropToBlob, releaseCanvas, renderNode } from './raster';
import { type RegionCapture } from './types';

/** Largest raster rendered, in pixels: the root is rendered whole before cropping. */
export const MAX_RASTER_PIXELS = 16_000_000;
/** Longest edge of the encoded image: what the model sees after its own resizing. */
export const MAX_IMAGE_EDGE = 1568;
const IMAGE_TYPE = 'image/webp';
const IMAGE_QUALITY = 0.85;
export const CAPTURE_TIMEOUT_MS = 10_000;

/** Source rectangle in raster pixels and the output size. */
export interface CropPlan {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  width: number;
  height: number;
}

type Failure = Extract<RegionCapture, { status: 'failed' }>;

/**
 * The pixel ratio to render a `width` x `height` CSS px root at: the device pixel ratio when the raster
 * fits the budget, otherwise the largest ratio that does. Null when even 1 raster pixel per CSS pixel
 * (or the device ratio, if lower) would exceed it.
 */
export function planPixelRatio(width: number, height: number, devicePixelRatio: number): number | null {
  const area = Math.max(width, 1) * Math.max(height, 1);
  if (area * devicePixelRatio ** 2 <= MAX_RASTER_PIXELS) {
    return devicePixelRatio;
  }
  const fit = Math.sqrt(MAX_RASTER_PIXELS / area);
  return fit >= Math.min(1, devicePixelRatio) ? fit : null;
}

/** Plans the crop of `region` (viewport coordinates) from a raster of `root` (viewport coordinates). */
export function planCrop(root: Box, region: Box, raster: { width: number; height: number }): CropPlan {
  const scaleX = raster.width / root.width;
  const scaleY = raster.height / root.height;
  const sx = clamp(Math.round((region.left - root.left) * scaleX), 0, raster.width - 1);
  const sy = clamp(Math.round((region.top - root.top) * scaleY), 0, raster.height - 1);
  const sw = clamp(Math.round(region.width * scaleX), 1, raster.width - sx);
  const sh = clamp(Math.round(region.height * scaleY), 1, raster.height - sy);
  const downscale = Math.min(1, MAX_IMAGE_EDGE / Math.max(sw, sh));
  return {
    sx,
    sy,
    sw,
    sh,
    width: Math.max(1, Math.round(sw * downscale)),
    height: Math.max(1, Math.round(sh * downscale)),
  };
}

export interface RenderRegionImageOptions {
  /** The element rendered; `region` must lie inside it. */
  root: HTMLElement;
  /** The region to crop, in viewport coordinates. */
  region: Box;
  /** Returns true for nodes (and their subtrees) to leave out of the render. */
  exclude: (node: Node) => boolean;
  /** Checked after each await: a cancelled capture frees its buffers and its result is never used. */
  isCancelled: () => boolean;
}

/** Renders `root` without the nodes `exclude` matches and returns the `region` crop. */
export async function renderRegionImage({
  root,
  region,
  exclude,
  isCancelled,
}: RenderRegionImageOptions): Promise<RegionCapture> {
  const rootRect = root.getBoundingClientRect();
  const pixelRatio = planPixelRatio(rootRect.width, rootRect.height, window.devicePixelRatio || 1);
  if (pixelRatio === null) {
    return failed('too_large');
  }

  let raster: HTMLCanvasElement;
  try {
    raster = await renderNode(root, {
      pixelRatio,
      filter: (candidate) => !exclude(candidate),
      // The page's background usually lives on an ancestor (a notebook cell paints none of its own), and a
      // transparent capture shows light-theme-on-dark text as nothing on a light background.
      backgroundColor: getEffectiveBackground(root),
    });
  } catch (error) {
    return failed(isSecurityError(error) ? 'unsupported' : 'failed');
  }
  try {
    if (isCancelled()) {
      return failed('failed');
    }
    const plan = planCrop(
      { left: rootRect.left, top: rootRect.top, width: rootRect.width, height: rootRect.height },
      region,
      raster
    );
    const image = await cropToBlob(raster, plan, IMAGE_TYPE, IMAGE_QUALITY);
    return { status: 'ready', image, width: plan.width, height: plan.height, capturedAt: new Date().toISOString() };
  } catch (error) {
    return failed(isSecurityError(error) ? 'unsupported' : 'failed');
  } finally {
    releaseCanvas(raster);
  }
}

/**
 * The colour `element` shows on screen behind its own content: its background, or the first one an ancestor
 * paints. Undefined when nothing does.
 */
export function getEffectiveBackground(element: Element): string | undefined {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const color = getComputedStyle(node).backgroundColor;
    if (color && !isTransparent(color)) {
      return color;
    }
  }
  return undefined;
}

function isTransparent(color: string): boolean {
  if (color === 'transparent') {
    return true;
  }
  // Computed colours are rgb() or rgba(); only a fourth component is an alpha, as in rgba(0, 0, 0, 0).
  const components =
    /^rgba?\(([^)]*)\)$/
      .exec(color)?.[1]
      .split(/[\s,/]+/)
      .filter(Boolean) ?? [];
  return components.length === 4 && parseFloat(components[3]) === 0;
}

export function failed(reason: Failure['reason']): Failure {
  return { status: 'failed', reason };
}

function isSecurityError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'SecurityError';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
