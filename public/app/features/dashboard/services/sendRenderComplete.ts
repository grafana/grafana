/**
 * Tells grafana-image-renderer that a capture has ended, over the chromedp binding it injects.
 * A no-op when the page is not being captured, because the binding is only present then.
 *
 * The renderer stops waiting as soon as any message arrives, so sending this early produces an
 * incomplete capture.
 */
export function sendRenderComplete(success: boolean): void {
  window.__grafanaImageRendererMessageChannel?.(JSON.stringify({ type: 'REPORT_RENDER_COMPLETE', data: { success } }));
}
