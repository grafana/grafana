/**
 * Tells grafana-image-renderer how a capture ended, over the chromedp binding it injects.
 *
 * The same message the dashboard report path sends — see
 * dashboard/services/ReportRenderReadinessObserver for the original, whose own sender is
 * module-private. Duplicated rather than imported so that notebooks do not depend on a dashboard
 * service for it.
 *
 * A no-op unless the renderer injected the binding, which it only does when Grafana advertised
 * support for it (the `reportRenderBinding` toggle, experimental and off by default). Otherwise the
 * renderer polls for the page to settle, which is how a successful capture is detected today.
 *
 * Only failure is reported. A successful render needs no message on the polling path, and reporting
 * one properly means waiting for every panel's queries to settle — see the note in
 * NotebookRenderPage about what that would take and when it becomes worth it.
 *
 * The renderer does not read the message, only notice that one arrived, so the `success: false`
 * below is discarded and this amounts to "stop waiting". That is what makes it useful on the
 * binding path, and what makes sending one early actively worse than sending none.
 */
export function reportRenderFailed(): void {
  window.__grafanaImageRendererMessageChannel?.(
    JSON.stringify({ type: 'REPORT_RENDER_COMPLETE', data: { success: false } })
  );
}
