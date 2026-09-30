/**
 * Tells grafana-image-renderer a capture has ended, over the chromedp binding it injects — a no-op
 * unless the `reportRenderBinding` toggle made Grafana advertise support for it.
 *
 * The renderer only notices that a message arrived, never reads it, so this amounts to "stop
 * waiting". That is what makes it useful for a failure, and what makes sending one early worse than
 * sending none. Duplicated from dashboard/services/ReportRenderReadinessObserver, whose sender is
 * module-private.
 */
export function reportRenderFailed(): void {
  window.__grafanaImageRendererMessageChannel?.(
    JSON.stringify({ type: 'REPORT_RENDER_COMPLETE', data: { success: false } })
  );
}
