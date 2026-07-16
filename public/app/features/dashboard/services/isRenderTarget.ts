import { contextSrv } from 'app/core/services/context_srv';
import { DashboardRoutes } from 'app/types/dashboard';

/**
 * True when the current page is being loaded specifically for image/PDF capture by the
 * grafana-image-renderer, or is otherwise a render-only surface (Report, Embedded).
 *
 * The chromedp binding check is the ground-truth signal for image-renderer captures.
 * `authenticatedBy === 'render'` is kept as a legacy fallback but is not currently
 * propagated to `contextSrv.user` in all render flows.
 */
export function isRenderTarget(route?: DashboardRoutes): boolean {
  if (route === DashboardRoutes.Report || route === DashboardRoutes.Embedded) {
    return true;
  }

  if (typeof window !== 'undefined' && typeof window.__grafanaImageRendererMessageChannel === 'function') {
    return true;
  }

  return contextSrv.user?.authenticatedBy === 'render';
}
