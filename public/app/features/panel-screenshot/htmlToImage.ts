/**
 * The core-private html-to-image renderer, shared by the panel screenshot service and Composer region
 * capture. html-to-image is loaded on first use so it stays out of the main bundle.
 */

export type HtmlToImageFormat = 'png' | 'jpeg' | 'webp';

const LOSSY_QUALITY = 0.92;

function loadHtmlToImage() {
  return import(/* webpackChunkName: "html-to-image" */ 'html-to-image');
}

export async function captureWithHtmlToImage(element: HTMLElement, format: HtmlToImageFormat): Promise<Blob> {
  const htmlToImage = await loadHtmlToImage();

  switch (format) {
    case 'png':
      return htmlToImage.toBlob(element).then(requireBlob);
    case 'jpeg':
      return htmlToImage.toBlob(element, { quality: LOSSY_QUALITY, type: 'image/jpeg' }).then(requireBlob);
    case 'webp':
      return htmlToImage.toBlob(element, { quality: LOSSY_QUALITY, type: 'image/webp' }).then(requireBlob);
    default: {
      const exhaustive: never = format;
      throw new Error(`Unsupported screenshot format: ${exhaustive}`);
    }
  }
}

export interface RenderToCanvasOptions {
  /** Raster pixels per CSS pixel. html-to-image defaults to the device pixel ratio. */
  pixelRatio?: number;
  /** Return false to leave a node (and its subtree) out of the rendered clone. */
  filter?: (node: HTMLElement) => boolean;
  /** Painted under the element. Without it, whatever the element does not paint itself is transparent. */
  backgroundColor?: string;
}

export async function renderToCanvas(
  element: HTMLElement,
  { pixelRatio, filter, backgroundColor }: RenderToCanvasOptions = {}
): Promise<HTMLCanvasElement> {
  const htmlToImage = await loadHtmlToImage();
  return htmlToImage.toCanvas(element, { pixelRatio, filter, backgroundColor });
}

function requireBlob(blob: Blob | null): Blob {
  if (!blob) {
    throw new Error('html-to-image returned a null Blob');
  }
  return blob;
}
