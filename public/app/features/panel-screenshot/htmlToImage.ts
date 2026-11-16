/**
 * The core-private html-to-image renderer, shared by the panel screenshot service and Composer region
 * capture. html-to-image is loaded on first use so it stays out of the main bundle.
 */

export type HtmlToImageFormat = 'png' | 'jpeg' | 'webp';

const LOSSY_QUALITY = 0.92;

function loadHtmlToImage() {
  return import(/* webpackChunkName: "html-to-image" */ 'html-to-image');
}

const UNREADABLE_SHEET_MESSAGE = 'Error while reading CSS rules from';

/** html-to-image's report of a stylesheet it could not read the rules of. */
function isUnreadableSheetReport(args: unknown[]): boolean {
  const [message, error] = args;
  return (
    typeof message === 'string' &&
    message.startsWith(UNREADABLE_SHEET_MESSAGE) &&
    error instanceof DOMException &&
    error.name === 'SecurityError'
  );
}

let runsSilencing = 0;
let restoreConsoleError: (() => void) | undefined;

/**
 * Runs `task` while html-to-image's report of a stylesheet it cannot read goes unlogged.
 *
 * A stylesheet served from another origin, such as the assets CDN, has no readable `cssRules` unless its link
 * has `crossorigin`. html-to-image fetches such a sheet and inlines its rules before it reads the rules again,
 * so the fonts are embedded either way, but it still logs a console error for the sheet it could not read.
 * Only that report is dropped; every other console.error passes through.
 */
async function withoutUnreadableSheetErrors<T>(task: () => Promise<T>): Promise<T> {
  if (runsSilencing === 0) {
    const original = console.error;
    const filtered: typeof console.error = (...args) => {
      if (!isUnreadableSheetReport(args)) {
        original.apply(console, args);
      }
    };
    console.error = filtered;
    restoreConsoleError = () => {
      // Someone else replaced console.error meanwhile; do not undo their change.
      if (console.error === filtered) {
        console.error = original;
      }
    };
  }
  runsSilencing++;
  try {
    return await task();
  } finally {
    runsSilencing--;
    if (runsSilencing === 0) {
      restoreConsoleError?.();
      restoreConsoleError = undefined;
    }
  }
}

export async function captureWithHtmlToImage(element: HTMLElement, format: HtmlToImageFormat): Promise<Blob> {
  const htmlToImage = await loadHtmlToImage();

  switch (format) {
    case 'png':
      return withoutUnreadableSheetErrors(() => htmlToImage.toBlob(element)).then(requireBlob);
    case 'jpeg':
      return withoutUnreadableSheetErrors(() =>
        htmlToImage.toBlob(element, { quality: LOSSY_QUALITY, type: 'image/jpeg' })
      ).then(requireBlob);
    case 'webp':
      return withoutUnreadableSheetErrors(() =>
        htmlToImage.toBlob(element, { quality: LOSSY_QUALITY, type: 'image/webp' })
      ).then(requireBlob);
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
  return withoutUnreadableSheetErrors(() => htmlToImage.toCanvas(element, { pixelRatio, filter, backgroundColor }));
}

function requireBlob(blob: Blob | null): Blob {
  if (!blob) {
    throw new Error('html-to-image returned a null Blob');
  }
  return blob;
}
