/**
 * The canvas side of region capture, kept apart from the planning so the maths can be tested without a
 * real raster.
 */

import { renderToCanvas } from 'app/features/panel-screenshot/htmlToImage';

import { type CropPlan } from './regionCapture';

export function renderNode(
  node: HTMLElement,
  options: { pixelRatio: number; filter: (node: HTMLElement) => boolean; backgroundColor?: string }
): Promise<HTMLCanvasElement> {
  return renderToCanvas(node, options);
}

/** Draws the planned crop of `source` at its output size and encodes it. */
export function cropToBlob(source: HTMLCanvasElement, plan: CropPlan, type: string, quality: number): Promise<Blob> {
  const target = document.createElement('canvas');
  target.width = plan.width;
  target.height = plan.height;
  const context = target.getContext('2d');
  if (!context) {
    releaseCanvas(target);
    return Promise.reject(new Error('Canvas 2D is not available'));
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, plan.sx, plan.sy, plan.sw, plan.sh, 0, 0, plan.width, plan.height);
  return new Promise<Blob>((resolve, reject) => {
    try {
      // Throws a SecurityError on a tainted canvas.
      target.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas encoding failed'))), type, quality);
    } catch (error) {
      reject(error);
    }
  }).finally(() => releaseCanvas(target));
}

/** Frees a canvas's backing store now rather than at garbage collection. */
export function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}
