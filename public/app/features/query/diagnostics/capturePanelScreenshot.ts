import { getPanelScreenshotService } from '@grafana/runtime';

/**
 * Upper bound on how long we wait for a panel capture.
 *
 * The underlying renderer (`html-to-image`, via the panel screenshot service) has no timeout of its
 * own, and its cost scales with the size of the *document*, not the panel: it walks every entry in
 * `document.styleSheets` on each call to inline web fonts. On a small dashboard a capture measures in
 * the low hundreds of milliseconds; on a large one (Grafana's emotion styles run to ~1000 sheets) the
 * same call has been measured taking tens of seconds. Without a bound, an unlucky capture would stall
 * the bundle the user is waiting for, so give up and ship the bundle without panel.png instead.
 */
const CAPTURE_TIMEOUT_MS = 10_000;

export interface CapturePanelScreenshotOptions {
  /**
   * Refuse to capture a panel scrolled out of the viewport. Defaults to `true`.
   *
   * The default protects the single-panel path, where an off-screen panel would be one that never ran
   * its queries (see {@link requireInViewport}). The whole-dashboard path sets this to `false`: it
   * deliberately makes off-screen panels run their queries first, so by the time it captures, "off
   * screen" no longer implies "empty".
   */
  requireInViewport?: boolean;
}

/**
 * Captures the panel as the user currently sees it and returns it as base64 PNG, or `undefined` if it
 * could not be captured.
 *
 * Best-effort by design. The screenshot is supporting evidence in a bundle whose primary artifacts are
 * the captured traffic and query data, so no capture failure may sink the download — every failure
 * path resolves to `undefined` and is reported to the caller through `onError` for recording.
 *
 * Must be called while the panel is mounted and painted: the service reads the live DOM, so it
 * faithfully reproduces whatever is on screen — including a panel that has not finished rendering,
 * which would be captured as a blank plot area.
 */
export async function capturePanelScreenshot(
  panelPathId: string,
  onError: (error: Error) => void,
  options: CapturePanelScreenshotOptions = {}
): Promise<string | undefined> {
  try {
    // The service is registered during app startup. Guard anyway: this module is also reachable from
    // contexts (tests, embedded hosts) that never ran that bootstrap.
    const service = getPanelScreenshotService();
    if (!service) {
      throw new Error('panel screenshot service is not available');
    }

    if (options.requireInViewport ?? true) {
      requireInViewport(panelPathId);
    }

    const blob = await withTimeout(service.capture(panelPathId, { format: 'png' }), CAPTURE_TIMEOUT_MS);
    return await blobToBase64(blob);
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
    return undefined;
  }
}

/**
 * Refuses to capture a panel that is scrolled out of the viewport.
 *
 * Dashboard panels are wrapped in scenes' `LazyLoader` with `mode="query"`, which mounts every panel's
 * DOM immediately but forwards viewport intersection to the query runner (`isInViewChanged`) so that an
 * off-screen panel can defer running its queries. The consequence for us: an off-screen panel *is*
 * capturable, but often renders as an empty "No data" panel because its query never ran.
 *
 * Shipping that image would be actively misleading — an unpopulated panel is indistinguishable from
 * the empty-panel bug this bundle usually exists to diagnose, and it was never on the user's screen
 * anyway. So treat "not in the viewport" as a refusal with a recorded reason, not as a capture.
 */
function requireInViewport(panelPathId: string): void {
  const element = document.querySelector(`[data-viz-panel-id="${CSS.escape(panelPathId)}"]`);
  if (!element) {
    // Let the capture service raise its own, more specific "Panel not in DOM" error.
    return;
  }
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const intersects = rect.bottom > 0 && rect.top < viewportHeight && rect.right > 0 && rect.left < viewportWidth;
  if (!intersects) {
    throw new Error(
      'panel was scrolled out of the viewport, so it was not captured (its queries may not have run, ' +
        'which would make the image show an empty panel the user never saw)'
    );
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`panel screenshot timed out after ${ms}ms`)), ms);
  });
  // The capture promise is abandoned rather than cancelled on timeout -- the renderer exposes no abort
  // signal. Clearing the timer keeps a fast capture from holding a pending timeout open.
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Reads the Blob as a base64 string, without the `data:image/png;base64,` prefix the backend does not
 * expect. FileReader is used rather than `btoa` over the bytes: a multi-megabyte PNG spread across
 * `String.fromCharCode(...bytes)` risks blowing the argument limit.
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('failed to read screenshot blob'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('screenshot blob did not read as a data URL'));
        return;
      }
      const comma = result.indexOf(',');
      if (comma === -1) {
        reject(new Error('screenshot data URL had no base64 payload'));
        return;
      }
      resolve(result.slice(comma + 1));
    };
    reader.readAsDataURL(blob);
  });
}
