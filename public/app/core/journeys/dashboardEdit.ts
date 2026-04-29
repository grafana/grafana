import { onInteraction, registerJourneyTriggers, onJourneyInstance } from '@grafana/runtime';

import { abandonOnRouteChange, collectUnsubs, str } from './utils';

/**
 * Journey: dashboard_edit
 *
 * User enters edit mode on a dashboard and saves or discards changes.
 *
 * Start triggers:
 *   - dashboards_edit_button_clicked — user clicks the Edit button on a dashboard
 *
 * End conditions:
 *   - success: grafana_dashboard_saved — dashboard saved (update of existing)
 *   - success: grafana_dashboard_created — dashboard saved (new dashboard created)
 *   - discarded: dashboards_edit_discarded — user discards all changes and exits edit mode
 *   - abandoned: SPA route change to a different pathname (user navigates away mid-edit)
 *   - timeout: 30 min — no end condition fires
 */

registerJourneyTriggers('dashboard_edit', (tracker) => {
  return onInteraction('dashboards_edit_button_clicked', (props) => {
    tracker.startJourney('dashboard_edit', {
      attributes: {
        dashboardUID: str(props.dashboardUid),
      },
    });
  });
});

onJourneyInstance('dashboard_edit', (handle) => {
  const { add, cleanup } = collectUnsubs();

  // Capture the dashboard pathname at journey start. Any pathname change
  // (switching dashboards, navigating to /dashboards, /explore, anywhere) is
  // abandonment — the user gave up the edit. Special-case: a new dashboard at
  // /dashboard/new is allowed to transition to /d/<new-uid> after save (the
  // route change can race with `grafana_dashboard_created`).
  const editingPath = window.location.pathname;
  const allowSaveTransition = editingPath === '/dashboard/new';
  add(
    abandonOnRouteChange(handle, (pathname) => {
      if (pathname === editingPath) {
        return true;
      }
      return allowSaveTransition && pathname.startsWith('/d/');
    })
  );

  add(
    onInteraction('grafana_dashboard_saved', () => {
      handle.end('success');
    })
  );

  add(
    onInteraction('grafana_dashboard_created', () => {
      handle.end('success');
    })
  );

  add(
    onInteraction('dashboards_edit_discarded', () => {
      handle.end('discarded');
    })
  );

  return cleanup;
});
