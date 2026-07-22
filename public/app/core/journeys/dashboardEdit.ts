import { onInteraction, registerJourneyTriggers, onJourneyInstance } from '@grafana/runtime';

import { abandonOnRouteChange, collectUnsubs, str } from './utils';

/**
 * Journey: dashboard_edit
 *
 * User enters edit mode on a dashboard and saves or discards changes.
 *
 * Start triggers:
 *   - dashboards_edit_button_clicked — user clicks the Edit button on a dashboard
 *   - dashboards_new_dashboard_init — user lands on /dashboard/new (auto edit mode);
 *     silent interaction emitted from DashboardScene's activation handler
 *
 * End conditions:
 *   - success: grafana_dashboard_saved — dashboard saved (update of existing)
 *   - success: grafana_dashboard_created — dashboard saved (new dashboard created)
 *   - discarded: dashboards_edit_discarded — user discards all changes and exits edit mode
 *   - discarded: dashboards_edit_exited — user exits edit mode (no-changes path; idempotent
 *     with edit_discarded which fires earlier on the dirty path)
 *   - abandoned: SPA route change to a different pathname (user navigates away mid-edit)
 *   - timeout: 30 min — no end condition fires
 *
 * Silent interactions added by this journey:
 *   - dashboards_new_dashboard_init — emitted in DashboardScene.tsx when /dashboard/new activates
 *   - dashboards_edit_exited — emitted in DashboardScene.tsx when exitEditMode resolves
 */

registerJourneyTriggers('dashboard_edit', (tracker) => {
  const { add, cleanup } = collectUnsubs();

  add(
    onInteraction('dashboards_edit_button_clicked', (props) => {
      tracker.startJourney('dashboard_edit', {
        attributes: {
          dashboardUID: str(props.dashboardUid),
          source: 'edit_button',
        },
      });
    })
  );

  add(
    onInteraction('dashboards_new_dashboard_init', () => {
      tracker.startJourney('dashboard_edit', {
        attributes: {
          dashboardUID: '',
          source: 'new_dashboard',
        },
      });
    })
  );

  return cleanup;
});

onJourneyInstance('dashboard_edit', (handle) => {
  const { add, cleanup } = collectUnsubs();

  // Capture the dashboard pathname at journey start. Navigating away from the
  // edit (e.g. /explore, /dashboards) is abandonment. Special-case: after save
  // creates a new dashboard — either first save from /dashboard/new, or Save As
  // from an existing /d/<uid> — the app navigates to /d/<new-uid>. That route
  // change can race with the async `grafana_dashboard_created` /
  // `grafana_dashboard_saved` interaction, so allow transitions onto /d/.
  const editingPath = window.location.pathname;
  const allowSaveTransition = editingPath === '/dashboard/new' || editingPath.startsWith('/d/');
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

  // Catches the no-changes exit path: dashboards_edit_discarded only fires on
  // dirty exit, edit_exited fires on every exit so the journey terminates
  // cleanly even when the user opens edit mode and leaves without changing
  // anything. handle.end is idempotent with the success/discarded paths above.
  add(
    onInteraction('dashboards_edit_exited', () => {
      handle.end('discarded');
    })
  );

  return cleanup;
});
