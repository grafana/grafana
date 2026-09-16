import { type DashboardScene } from './DashboardScene';

/**
 * Nothing can be edited or acted on while a plan preview is showing — the preview never enters
 * edit mode, and Grafana's own view-mode rules already suppress everything that requires it. This
 * covers what those rules don't: actions reachable through an unconditional menu item, a keyboard
 * shortcut, or a URL parameter, none of which check `isEditing`, so each is refused explicitly
 * here instead.
 */
export function refuseWhilePlanning(dashboard: DashboardScene): boolean {
  return dashboard.isPlanning();
}
