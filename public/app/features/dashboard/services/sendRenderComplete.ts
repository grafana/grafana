/** Why a page could not be captured, for example that the dashboard does not exist. */
export interface RenderFailure {
  /** HTTP status of the failed request, when there is one. */
  status?: number;
  message: string;
}

/**
 * Tells grafana-image-renderer that a capture has ended, over the chromedp binding it injects.
 * A no-op when the page is not being captured, because the binding is only present then.
 *
 * The renderer stops waiting as soon as any message arrives, so sending this early produces an
 * incomplete capture.
 *
 * Pass `error` with `success: false` when the page could not load and there is nothing worth capturing.
 * The renderer then fails the request with that reason instead of returning an image of the error page.
 * `success: false` without an error is still captured, which is what a partial capture relies on.
 */
export function sendRenderComplete(success: boolean, error?: RenderFailure): void {
  window.__grafanaImageRendererMessageChannel?.(
    JSON.stringify({ type: 'REPORT_RENDER_COMPLETE', data: error ? { success, error } : { success } })
  );
}
